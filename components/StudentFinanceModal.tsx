'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Check, Loader2, DollarSign, Calendar, RefreshCcw, Copy, MessageSquare } from 'lucide-react';
import { useFinance } from './FinanceContext';

type StudentFinanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onSuccess: () => void;
};

type SessionItem = {
  id: string;
  date: string;
  status: string;
  paid: boolean;
  amount: number;
  type: string;
  groupName?: string;
  attendee_ids: any;
  attended: boolean;
  receipt?: string;
};

export function StudentFinanceModal({ isOpen, onClose, student, onSuccess }: StudentFinanceModalProps) {
  const { formatCurrency } = useFinance();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [monthGroups, setMonthGroups] = useState<{ month: string; total: number; pending: number; sessions: SessionItem[] }[]>([]);
  const [copiedMonth, setCopiedMonth] = useState<string | null>(null);
  const [studentPlan, setStudentPlan] = useState<any>(null);
  const [studentsMap, setStudentsMap] = useState<Record<string, string>>({});
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);

  const parseSessionDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    // If it's a YYYY-MM-DD string without time (e.g. "2026-07-29")
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const formatDate = (dateStr: string) => {
    const d = parseSessionDate(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const formatDateWithYear = (dateStr: string) => {
    const d = parseSessionDate(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatRawCurrency = (value: number) => {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateShareText = (group: { month: string; total: number; pending: number; sessions: SessionItem[] }) => {
    const studentName = student?.name || 'Aluno';
    const monthName = group.month;

    // Check if any sessions of this group/month are selected
    const selectedGroupSessions = group.sessions.filter(s => selectedSessions.has(s.id));
    const isFiltered = selectedGroupSessions.length > 0;
    const sessionsToInclude = isFiltered ? selectedGroupSessions : group.sessions;

    const totalClasses = sessionsToInclude.length;

    let totalValue = 0;
    let pendingValue = 0;

    const isMonthlyPlan = studentPlan && (
      studentPlan.billing_cycle === 'mês' || 
      studentPlan.billing_cycle === 'pacote' || 
      studentPlan.type === 'Pagamento Mensal Fixo'
    );

    if (isFiltered) {
      if (isMonthlyPlan) {
        // Proportional to the selected classes out of all month classes
        const totalMonthClasses = group.sessions.length;
        const proportionalPricePerSession = totalMonthClasses > 0 ? Number(studentPlan.price) / totalMonthClasses : 0;
        
        sessionsToInclude.forEach(s => {
          totalValue += proportionalPricePerSession;
          if (!s.paid) {
            pendingValue += proportionalPricePerSession;
          }
        });
      } else {
        // Just sum the individual session amounts
        sessionsToInclude.forEach(s => {
          totalValue += s.amount;
          if (!s.paid) {
            pendingValue += s.amount;
          }
        });
      }
    } else {
      // Use the pre-computed month totals
      totalValue = group.total;
      pendingValue = group.pending;
    }

    const pendingFormatted = formatRawCurrency(pendingValue);
    const totalFormatted = formatRawCurrency(totalValue);

    let text = `*Resumo de Aulas - ${studentName}*\n`;
    text += `📅 *Mês:* ${monthName}${isFiltered ? ' (Aulas Selecionadas)' : ''}\n`;
    text += `👟 *Aulas dadas:* ${totalClasses}\n`;
    
    if (pendingValue > 0) {
      text += `💰 *Valor a receber:* ${pendingFormatted}\n`;
    } else {
      text += `💰 *Valor total:* ${totalFormatted} (Pago)\n`;
    }
    
    text += `\n*Datas das aulas:*\n`;
    
    // Sort chronological for readability
    const sortedSessions = [...sessionsToInclude].sort((a, b) => parseSessionDate(a.date).getTime() - parseSessionDate(b.date).getTime());
    sortedSessions.forEach((session) => {
      const dateFormatted = formatDate(session.date);
      let sessionAmt = session.amount;
      if (isFiltered && isMonthlyPlan) {
        const totalMonthClasses = group.sessions.length;
        sessionAmt = totalMonthClasses > 0 ? Number(studentPlan.price) / totalMonthClasses : 0;
      }
      const amtStr = formatRawCurrency(sessionAmt);
      const status = session.paid ? 'Pago' : 'Pendente';
      
      let attendance = '';
      if (student.isGroup) {
         let attendeesList: string[] = [];
         if (Array.isArray(session.attendee_ids)) attendeesList = session.attendee_ids;
         else if (session.attendee_ids) attendeesList = session.attendee_ids.attendees || [];
         
         if (attendeesList.length > 1) {
            const names = attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join(' e ');
            attendance = `(${names})`;
         } else if (attendeesList.length === 1) {
            const names = attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join('');
            attendance = `(${names})`;
         } else {
            attendance = '(Falta)';
         }
      } else {
         const classType = session.groupName ? `${session.groupName}` : '';
         if (!session.attended) {
            attendance = classType ? `(${classType} - Falta)` : '(Falta)';
         } else if (classType) {
            attendance = `(${classType})`;
         }
      }
      
      const attendancePart = attendance ? ` ${attendance}` : '';
      text += `• ${dateFormatted} - ${amtStr}${attendancePart}\n`;
    });
    
    return text;
  };

  const handleCopyText = (group: { month: string; total: number; pending: number; sessions: SessionItem[] }) => {
    const text = generateShareText(group);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMonth(group.month);
      setTimeout(() => setCopiedMonth(null), 2000);
    });
  };

  const getWhatsappUrl = (group: { month: string; total: number; pending: number; sessions: SessionItem[] }) => {
    const text = generateShareText(group);
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  useEffect(() => {
    if (isOpen && student) {
      fetchFinanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student]);

  async function fetchFinanceData() {
    setIsLoading(true);
    try {
      // Fetch all sessions
      const { data: sessionsData } = await supabase.from('sessions').select('*');
      const { data: plansData } = await supabase.from('plans').select('*');
      const { data: groupsData } = await supabase.from('groups').select('*');
      const { data: groupStudentsData } = await supabase.from('group_students').select('*');
      const { data: studentsData } = await supabase.from('students').select('id, name, plan_id');
      
      if (!sessionsData || !plansData || !groupsData) return;

      if (studentsData) {
        const sMap: Record<string, string> = {};
        studentsData.forEach(s => sMap[s.id] = s.name);
        setStudentsMap(sMap);
      }

      const studentGroups = groupStudentsData?.filter(gs => gs.student_id === student.id).map(gs => gs.group_id) || [];
      const studentPlan = plansData.find(p => p.id === student.plan_id);
      setStudentPlan(studentPlan);

      const items: SessionItem[] = [];

      sessionsData.forEach(s => {
        if (s.status !== 'completed' && s.status !== 'replaced') return;

        let attendees: string[] = [];
        let isPaid = s.attendee_ids?.paid || false;
        let additionalValue = s.attendee_ids?.additional_value || 0;

        if (Array.isArray(s.attendee_ids)) {
          attendees = s.attendee_ids;
        } else if (s.attendee_ids) {
          attendees = s.attendee_ids.attendees || [];
        }

        let isRelevant = false;
        let sessionAmount = 0;
        let groupName = '';

        if (student.isGroup) {
          if (s.type === 'group' && s.reference_id === student.id) {
            isRelevant = true;
            let baseAmount = 0;
            if (attendees.length > 1) {
              const gPlan = plansData.find(p => p.id === student.plan_id);
              if (gPlan) baseAmount = Number(gPlan.price);
            } else if (attendees.length === 1) {
              const attStudent = studentsData?.find(st => st.id === attendees[0]);
              if (attStudent) {
                const sPlan = plansData.find(p => p.id === attStudent.plan_id);
                if (sPlan) baseAmount = Number(sPlan.price);
              }
            }
            sessionAmount = baseAmount + Number(additionalValue);
            let receiptUrl = s.attendee_ids?.receipt || undefined;
            items.push({
              id: s.id,
              date: s.date,
              status: s.status,
              paid: isPaid,
              amount: sessionAmount,
              type: s.type,
              groupName: student.name,
              attendee_ids: s.attendee_ids,
              attended: attendees.length > 0,
              receipt: receiptUrl
            });
          }
        } else {
          if (s.type === 'student' && s.reference_id === student.id) {
            isRelevant = true;
            if (studentPlan) {
              sessionAmount = Number(studentPlan.price);
            }
            sessionAmount += Number(additionalValue);
          } else if (s.type === 'group' && studentGroups.includes(s.reference_id)) {
            // If group is not academia and student is in attendees (or it's a fixed group)
            const group = groupsData.find(g => g.id === s.reference_id);
            const gPlan = plansData.find(p => p.id === group?.plan_id);
            
            if (group && gPlan) {
              groupName = group.name;
              if (group.class_category === 'academia') {
                // Not relevant for individual finance typically, but if needed, we add it.
              } else {
                isRelevant = true;
                if (attendees.length === 1 && attendees[0] === student.id) {
                   sessionAmount = studentPlan ? Number(studentPlan.price) : Number(gPlan.price);
                } else if (attendees.includes(student.id)) {
                   sessionAmount = Number(gPlan.price); 
                   // Note: we assign the group price to the student here to show what they owe
                }
              }
            }
            sessionAmount += Number(additionalValue);
          }

          if (isRelevant) {
            let receiptUrl = s.attendee_ids?.receipt || undefined;
            items.push({
              id: s.id,
              date: s.date,
              status: s.status,
              paid: isPaid,
              amount: sessionAmount,
              type: s.type,
              groupName,
              attendee_ids: s.attendee_ids,
              attended: attendees.includes(student.id),
              receipt: receiptUrl
            });
          }
        }
      });

      items.sort((a, b) => parseSessionDate(b.date).getTime() - parseSessionDate(a.date).getTime());

      // Group by month
      const groupsMap = new Map<string, SessionItem[]>();
      items.forEach(item => {
        const d = parseSessionDate(item.date);
        const monthYear = `${d.toLocaleString('pt-BR', { month: 'long' })} ${d.getFullYear()}`.replace(/^\w/, c => c.toUpperCase());
        if (!groupsMap.has(monthYear)) groupsMap.set(monthYear, []);
        groupsMap.get(monthYear)?.push(item);
      });

      const processedGroups = Array.from(groupsMap.entries()).map(([month, monthSessions]) => {
        let total = 0;
        let pending = 0;
        
        // For monthly plans, we only sum once per month.
        if (studentPlan && (studentPlan.billing_cycle === 'mês' || studentPlan.billing_cycle === 'pacote' || studentPlan.type === 'Pagamento Mensal Fixo')) {
           const hasPaid = monthSessions.some(s => s.paid);
           total = Number(studentPlan.price);
           if (!hasPaid) pending = total;
        } else {
           monthSessions.forEach(s => {
             total += s.amount;
             if (!s.paid) pending += s.amount;
           });
        }

        return { month, total, pending, sessions: monthSessions };
      });

      setSessions(items);
      setMonthGroups(processedGroups);
      setSelectedSessions(new Set());

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSession = (id: string) => {
    const newSet = new Set(selectedSessions);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSessions(newSet);
  };

  const selectMonth = (monthSessions: SessionItem[]) => {
    const newSet = new Set(selectedSessions);
    monthSessions.forEach(s => newSet.add(s.id));
    setSelectedSessions(newSet);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
       if (file.size > 2 * 1024 * 1024) {
          alert('Arquivo muito grande. Máximo 2MB.');
          return;
       }
       const reader = new FileReader();
       reader.onload = (event) => setReceiptBase64(event.target?.result as string);
       reader.readAsDataURL(file);
       return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      setReceiptBase64(dataUrl);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleUpdateStatus = async (markAsPaid: boolean) => {
    if (selectedSessions.size === 0) return;
    setIsSaving(true);
    try {
      // Fetch current sessions to keep other attendee data intact
      const { data: currentData } = await supabase.from('sessions').select('*').in('id', Array.from(selectedSessions));
      
      if (!currentData) return;

      for (const session of currentData) {
         let newAttendeeIds = session.attendee_ids || {};
         if (Array.isArray(newAttendeeIds)) {
           newAttendeeIds = { attendees: newAttendeeIds, paid: markAsPaid };
         } else {
           newAttendeeIds = { ...newAttendeeIds, paid: markAsPaid };
         }
         
         if (markAsPaid && receiptBase64) {
           newAttendeeIds.receipt = receiptBase64;
         } else if (!markAsPaid) {
           delete newAttendeeIds.receipt;
         }
         
         await supabase.from('sessions').update({ attendee_ids: newAttendeeIds }).eq('id', session.id);
      }

      // Also update student/group status if they have no more pending classes (or if they are marking as paid)
      if (markAsPaid) {
        if (student.isGroup) {
          // If groups had a status, we would update it here, but they don't currently use 'status'.
        } else {
          await supabase.from('students').update({ status: 'Pago' }).eq('id', student.id);
        }
      }
      
      setReceiptBase64(null);
      setSelectedSessions(new Set());
      onSuccess();
      fetchFinanceData(); // reload internally
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start sm:items-center p-5 sm:p-8 border-b border-outline-variant bg-surface-container-lowest gap-4">
          <div className="min-w-0">
            <h2 className="font-headline-sm md:font-headline-md font-bold text-on-surface truncate">Financeiro & Extrato</h2>
            <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
              Acompanhe aulas e pagamentos de <span className="font-bold">{student?.name}</span>.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant hover:text-on-surface shrink-0">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-surface-container-lowest flex flex-col gap-5 sm:gap-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : monthGroups.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant bg-surface rounded-2xl border border-outline-variant">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-label-lg">Nenhuma aula concluída encontrada.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {selectedSessions.size > 0 && (
                <div className="sticky top-0 bg-primary-container text-on-primary-container p-4 rounded-xl flex flex-col items-stretch sm:flex-row sm:items-center justify-between border border-primary/20 z-10 shadow-sm gap-3 transition-all">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <span className="font-label-md font-bold text-center sm:text-left">{selectedSessions.size} {selectedSessions.size === 1 ? 'aula selecionada' : 'aulas selecionadas'}</span>
                    
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-surface/50 hover:bg-surface/80 rounded-lg text-sm font-bold transition-colors">
                      <span className="truncate max-w-[120px]">{receiptBase64 ? 'Comprovante Anexado' : 'Anexar Comprovante'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {receiptBase64 && (
                       <button onClick={() => setReceiptBase64(null)} className="p-1 hover:bg-surface/80 rounded-full">
                          <X className="w-4 h-4" />
                       </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                     <button onClick={() => handleUpdateStatus(true)} disabled={isSaving} className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-on-primary rounded-xl font-label-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                       {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                       Marcar Pago
                     </button>
                     <button onClick={() => handleUpdateStatus(false)} disabled={isSaving} className="flex-1 sm:flex-none px-4 py-2.5 bg-error text-on-error rounded-xl font-label-sm font-bold hover:bg-error/90 transition-colors flex items-center justify-center gap-2">
                       {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                       Marcar Pendente
                     </button>
                  </div>
                </div>
              )}

              {monthGroups.map((group) => (
                <div key={group.month} className="border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-surface-container p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div>
                      <h4 className="font-title-md font-bold text-on-surface">{group.month}</h4>
                      <div className="font-body-sm text-on-surface-variant flex flex-col sm:flex-row sm:gap-3 gap-1 mt-2 sm:mt-1">
                        <span>
                          <span className="font-bold text-on-surface">Total:</span> {formatCurrency(group.total)}
                        </span>
                        <span>
                          <span className="font-bold text-primary">Recebido:</span> {formatCurrency(group.total - group.pending)}
                        </span>
                        <span className={group.pending > 0 ? "text-error font-bold" : "text-on-surface-variant"}>
                          A Pagar: {formatCurrency(group.pending)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
                      <button 
                        onClick={() => selectMonth(group.sessions)} 
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        Selecionar mês
                      </button>
                      <button 
                        onClick={() => handleCopyText(group)} 
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary font-label-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                        title="Copiar resumo do mês"
                      >
                        {copiedMonth === group.month ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar
                          </>
                        )}
                      </button>
                      <a 
                        href={getWhatsappUrl(group)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] font-label-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                        title="Enviar para o WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                    {group.sessions.map(session => (
                      <div key={session.id} className="p-4 flex items-start sm:items-center gap-3 sm:gap-4 hover:bg-surface-container/30 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedSessions.has(session.id)}
                          onChange={() => toggleSession(session.id)}
                          className="w-5 h-5 mt-0.5 sm:mt-0 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            {session.status === 'replaced' ? (
                              <RefreshCcw className="w-4 h-4 text-secondary" />
                            ) : session.attended ? (
                              <Check className="w-4 h-4 text-primary" />
                            ) : (
                              <X className="w-4 h-4 text-error" />
                            )}
                            <span className="font-label-md font-bold text-on-surface">
                              {formatDateWithYear(session.date)}
                            </span>
                            {!session.attended && session.status !== 'replaced' && (
                               <span className="font-label-sm text-error px-2 py-0.5 bg-error/10 rounded-full">
                                 Falta
                               </span>
                            )}
                            {session.groupName && (
                              <span className="font-label-sm text-on-surface-variant px-2 py-0.5 bg-surface-container rounded-full truncate max-w-[120px] sm:max-w-none">
                                {session.groupName}
                              </span>
                            )}
                            {student.isGroup && (
                              <span className="font-label-sm text-on-surface-variant px-2 py-0.5 bg-surface-container rounded-full truncate max-w-full">
                                {(() => {
                                  let attendeesList: string[] = [];
                                  if (Array.isArray(session.attendee_ids)) attendeesList = session.attendee_ids;
                                  else if (session.attendee_ids) attendeesList = session.attendee_ids.attendees || [];
                                  if (attendeesList.length > 1) return 'Presentes: ' + attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join(' e ');
                                  if (attendeesList.length === 1) return 'Presente: ' + attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join(', ');
                                  return 'Faltaram todos';
                                })()}
                              </span>
                            )}
                          </div>
                          <p className="font-body-sm text-on-surface-variant">
                            Valor: {formatCurrency(session.amount)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right flex flex-col items-end gap-1">
                           {session.paid ? (
                              <span className="inline-flex px-2 py-1 bg-primary/10 text-primary rounded text-xs font-bold">Pago</span>
                           ) : (
                              <span className="inline-flex px-2 py-1 bg-error-container/50 text-error rounded text-xs font-bold border border-error/20">Pendente</span>
                           )}
                           {session.receipt && (
                              <a href={session.receipt} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                Comprovante
                              </a>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
