'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Check, Loader2, DollarSign, Calendar, RefreshCcw, Copy, MessageSquare } from 'lucide-react';
import { useFinance } from './FinanceContext';
import { uploadReceipt, listReceiptsForStudent, getReceiptUrl, Receipt } from '@/lib/receipts';
import { useRouter } from 'next/navigation';
import { Paperclip, FileText, Image as ImageIcon, Eye, FolderOpen, ArrowRight } from 'lucide-react';

type StudentFinanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onSuccess: () => void;
  onOpenReceipts?: () => void;
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
  academia?: { perStudent: boolean; count: number };
};

export function StudentFinanceModal({ isOpen, onClose, student, onSuccess, onOpenReceipts }: StudentFinanceModalProps) {
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

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
      if (session.academia) {
         attendance = session.academia.perStudent ? `(${session.academia.count} alunos)` : '';
      } else if (student.isGroup) {
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
            const thisGroup = groupsData.find(g => g.id === student.id);
            const gPlan = plansData.find(p => p.id === (thisGroup?.plan_id ?? student.plan_id));
            if (thisGroup?.class_category === 'academia') {
              // Professor de sala: recebe por aula dada (x duração) ou por aluno que foi na aula
              const perStudent = !!gPlan && (gPlan.billing_cycle === 'aluno' || gPlan.type === 'Pagamento por aluno');
              const count = Number(s.attendee_ids?.academia_count) || attendees.length;
              if (gPlan) {
                baseAmount = perStudent
                  ? Number(gPlan.price) * count
                  : (gPlan.billing_cycle === 'aula' || gPlan.type === 'Pagamento por aula')
                    ? Number(gPlan.price) * (Number(thisGroup.duration) || 1)
                    : Number(gPlan.price);
              }
              items.push({
                id: s.id,
                date: s.date,
                status: s.status,
                paid: isPaid,
                amount: baseAmount + Number(additionalValue),
                type: s.type,
                groupName: student.name,
                attendee_ids: s.attendee_ids,
                attended: true,
                receipt: s.attendee_ids?.receipt || undefined,
                academia: { perStudent, count },
              });
              return;
            }
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
    setReceiptFile(file);
    if (!file.type.startsWith('image/')) {
      // PDFs vão apenas para a área de Comprovantes
      setReceiptBase64(null);
      return;
    }
    
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

      if (markAsPaid && receiptFile) {
        try {
          const paidAmount = monthGroups
            .flatMap(g => g.sessions)
            .filter(s => selectedSessions.has(s.id))
            .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
          await uploadReceipt(receiptFile, {
            studentId: student?.isGroup ? null : student?.id,
            studentName: student?.name,
            amount: paidAmount || null,
            description: 'Pagamento de ' + selectedSessions.size + (selectedSessions.size === 1 ? ' aula' : ' aulas'),
          });
        } catch (receiptErr) {
          console.error('Error saving receipt file:', receiptErr);
          alert('Pagamento marcado, mas o comprovante não foi salvo na área de Comprovantes.');
        }
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
      setReceiptFile(null);
      setSelectedSessions(new Set());
      onSuccess();
      fetchFinanceData(); // reload internally
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const router = useRouter();
  const [studentReceipts, setStudentReceipts] = useState<Receipt[]>([]);
  const [openingReceiptId, setOpeningReceiptId] = useState<string | null>(null);

  const loadStudentReceipts = async () => {
    if (!student) return;
    try {
      const data = await listReceiptsForStudent(student.isGroup ? null : student.id, student.name, 4);
      setStudentReceipts(data);
    } catch (err) {
      console.error('Error loading student receipts:', err);
      setStudentReceipts([]);
    }
  };

  useEffect(() => {
    if (isOpen && student) loadStudentReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student?.id]);

  const openReceipt = async (receipt: Receipt) => {
    setOpeningReceiptId(receipt.id);
    const win = window.open('', '_blank');
    try {
      const url = await getReceiptUrl(receipt);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err: any) {
      if (win) win.close();
      alert(err?.message || 'Não foi possível abrir o comprovante.');
    } finally {
      setOpeningReceiptId(null);
    }
  };

  const goToReceipts = () => {
    if (onOpenReceipts) {
      onOpenReceipts();
      return;
    }
    onClose();
    router.push('/relatorios?tab=comprovantes' + (student && !student.isGroup ? '&aluno=' + student.id : ''));
  };

  const handleMarkPaid = async () => {
    await handleUpdateStatus(true);
    loadStudentReceipts();
  };

  const allSessions = monthGroups.flatMap(g => g.sessions);
  const selectedTotal = allSessions
    .filter(s => selectedSessions.has(s.id))
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalPending = monthGroups.reduce((sum, g) => sum + (Number(g.pending) || 0), 0);
  const totalReceived = monthGroups.reduce((sum, g) => sum + Math.max(0, (Number(g.total) || 0) - (Number(g.pending) || 0)), 0);
  const studentInitials = String(student?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase();
  const attachedName = receiptFile ? receiptFile.name : (receiptBase64 ? 'Imagem anexada' : '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-[#0f766e] via-[#047857] to-[#065f46] text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center font-bold text-lg shrink-0">
                {studentInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-white/70 font-bold">Financeiro & Extrato</p>
                <h2 className="text-xl font-bold truncate">{student?.name}</h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Recebido</p>
              <p className="font-bold text-sm sm:text-base mt-0.5 truncate">{formatCurrency(totalReceived)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">A receber</p>
              <p className={'font-bold text-sm sm:text-base mt-0.5 truncate ' + (totalPending > 0 ? 'text-[#fcd34d]' : '')}>{formatCurrency(totalPending)}</p>
            </div>
            <button
              type="button"
              onClick={goToReceipts}
              className="rounded-2xl bg-white/10 hover:bg-white/20 transition-colors px-3 py-2.5 text-left"
            >
              <p className="text-[10px] uppercase tracking-wider text-white/70 font-bold">Comprovantes</p>
              <p className="font-bold text-sm sm:text-base mt-0.5 flex items-center gap-1">
                {studentReceipts.length >= 4 ? '4+' : studentReceipts.length}
                <ArrowRight className="w-3.5 h-3.5 opacity-80" />
              </p>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 bg-surface-container-lowest">
          {/* Comprovantes do aluno */}
          <section className="shrink-0 rounded-2xl border border-outline-variant bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary" /> Comprovantes
              </h3>
              <button type="button" onClick={goToReceipts} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {studentReceipts.length === 0 ? (
              <p className="text-xs text-on-surface-variant mt-2">
                Nenhum comprovante ainda. Selecione as aulas abaixo, anexe a foto ou o PDF e marque como pago.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 mt-3">
                {studentReceipts.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openReceipt(r)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container transition-colors text-left"
                  >
                    <div className={'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + (r.file_type === 'application/pdf' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dbeafe] text-[#1d4ed8]')}>
                      {r.file_type === 'application/pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">{r.description || r.file_name}</p>
                      <p className="text-xs text-on-surface-variant">{r.payment_date.split('-').reverse().join('/')}</p>
                    </div>
                    {r.amount != null && <span className="text-sm font-bold text-on-surface shrink-0">{formatCurrency(Number(r.amount))}</span>}
                    {openingReceiptId === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <Eye className="w-4 h-4 text-on-surface-variant shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Extrato por mês */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : monthGroups.length === 0 ? (
            <div className="shrink-0 text-center py-12 text-on-surface-variant bg-surface rounded-2xl border border-outline-variant">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-label-lg">Nenhuma aula concluída encontrada.</p>
            </div>
          ) : (
            monthGroups.map((group) => {
              const monthAllSelected = group.sessions.length > 0 && group.sessions.every(s => selectedSessions.has(s.id));
              return (
                <section key={group.month} className="shrink-0 rounded-2xl border border-outline-variant bg-surface overflow-hidden">
                  <div className="p-4 flex flex-col gap-3 border-b border-outline-variant/60">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-bold text-on-surface">{group.month}</h4>
                      <button
                        type="button"
                        onClick={() => selectMonth(group.sessions)}
                        disabled={monthAllSelected}
                        className="text-xs font-bold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        {monthAllSelected ? 'Mês selecionado' : 'Selecionar mês'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-surface-container-low px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Total</p>
                        <p className="text-sm font-bold text-on-surface truncate">{formatCurrency(group.total)}</p>
                      </div>
                      <div className="rounded-xl bg-primary/10 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Recebido</p>
                        <p className="text-sm font-bold text-primary truncate">{formatCurrency(group.total - group.pending)}</p>
                      </div>
                      <div className={'rounded-xl px-3 py-2 ' + (group.pending > 0 ? 'bg-[#fef3c7]' : 'bg-surface-container-low')}>
                        <p className={'text-[10px] uppercase tracking-wider font-bold ' + (group.pending > 0 ? 'text-[#b45309]' : 'text-on-surface-variant')}>A pagar</p>
                        <p className={'text-sm font-bold truncate ' + (group.pending > 0 ? 'text-[#b45309]' : 'text-on-surface')}>{formatCurrency(group.pending)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyText(group)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors"
                        title="Copiar resumo do mês"
                      >
                        {copiedMonth === group.month ? (
                          <><Check className="w-4 h-4 text-primary" /> Copiado!</>
                        ) : (
                          <><Copy className="w-4 h-4" /> Copiar resumo</>
                        )}
                      </button>
                      <a
                        href={getWhatsappUrl(group)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-xs font-bold transition-colors"
                        title="Enviar para o WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="divide-y divide-outline-variant/50">
                    {group.sessions.map(session => {
                      const isSelected = selectedSessions.has(session.id);
                      return (
                        <label
                          key={session.id}
                          className={'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ' + (isSelected ? 'bg-primary/5' : 'hover:bg-surface-container/40')}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSession(session.id)}
                            className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {session.status === 'replaced' ? (
                                <RefreshCcw className="w-3.5 h-3.5 text-secondary" />
                              ) : session.attended ? (
                                <Check className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-error" />
                              )}
                              <span className="font-bold text-sm text-on-surface">{formatDateWithYear(session.date)}</span>
                              {!session.attended && session.status !== 'replaced' && (
                                <span className="text-[11px] font-bold text-error px-2 py-0.5 bg-error/10 rounded-full">Falta</span>
                              )}
                              {session.groupName && (
                                <span className="text-[11px] text-on-surface-variant px-2 py-0.5 bg-surface-container rounded-full truncate max-w-[140px]">{session.groupName}</span>
                              )}
                            </div>
                            {student?.isGroup && (
                              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                                {(() => {
                                  let attendeesList: string[] = [];
                                  if (Array.isArray(session.attendee_ids)) attendeesList = session.attendee_ids;
                                  else if (session.attendee_ids) attendeesList = session.attendee_ids.attendees || [];
                                  if (session.academia) {
                                    return session.academia.perStudent
                                      ? (session.academia.count === 1 ? '1 aluno na aula' : session.academia.count + ' alunos na aula')
                                      : 'Aula dada';
                                  }
                                  if (attendeesList.length > 1) return 'Presentes: ' + attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join(' e ');
                                  if (attendeesList.length === 1) return 'Presente: ' + attendeesList.map(id => studentsMap[id]?.split(' ')[0] || 'Aluno').join(', ');
                                  return 'Faltaram todos';
                                })()}
                              </p>
                            )}
                            {session.receipt && (
                              <a
                                href={session.receipt}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const w = window.open('', '_blank');
                                  if (w) w.document.write('<title>Comprovante</title><img src="' + session.receipt + '" style="max-width:100%;display:block;margin:0 auto" />');
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mt-0.5"
                              >
                                <Paperclip className="w-3 h-3" /> Comprovante
                              </a>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm text-on-surface">{formatCurrency(session.amount)}</p>
                            {session.paid ? (
                              <span className="text-[11px] font-bold text-primary">Pago</span>
                            ) : (
                              <span className="text-[11px] font-bold text-[#b45309]">Pendente</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Barra de ações (aparece ao selecionar aulas) */}
        {selectedSessions.size > 0 && (
          <div className="shrink-0 border-t border-outline-variant bg-surface p-4 sm:px-6 flex flex-col gap-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-on-surface">
                <span className="font-bold">{selectedSessions.size} {selectedSessions.size === 1 ? 'aula selecionada' : 'aulas selecionadas'}</span>
                <span className="text-on-surface-variant"> • {formatCurrency(selectedTotal)}</span>
              </p>
              <button type="button" onClick={() => setSelectedSessions(new Set())} className="text-xs font-bold text-on-surface-variant hover:text-on-surface">
                Limpar
              </button>
            </div>

            {attachedName ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/5">
                <Paperclip className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-on-surface truncate">{attachedName}</p>
                  <p className="text-[11px] text-on-surface-variant">Será salvo em Comprovantes ao marcar como pago</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setReceiptBase64(null); setReceiptFile(null); }}
                  className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant shrink-0"
                  aria-label="Remover comprovante"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-surface-container text-sm font-bold text-on-surface-variant cursor-pointer transition-colors">
                <Paperclip className="w-4 h-4" /> Anexar comprovante (foto ou PDF)
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdateStatus(false)}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 py-3 rounded-full border border-outline-variant text-on-surface-variant font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Marcar pendente
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Marcar pago
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
