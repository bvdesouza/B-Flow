'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { X, Check, Plus, Loader2, Trash2, AlertTriangle, UserPlus, Search } from 'lucide-react';

type ClassCheckModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agendaItem: any;
  date: Date;
  onSuccess: () => void;
};

export function ClassCheckModal({ isOpen, onClose, agendaItem, date, onSuccess }: ClassCheckModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [groupStudents, setGroupStudents] = useState<string[]>([]);
  const [presentStudents, setPresentStudents] = useState<string[]>([]);
  const [externalVisitors, setExternalVisitors] = useState<string[]>([]);
  const [newVisitorName, setNewVisitorName] = useState("");
  const [visitorSearch, setVisitorSearch] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [academiaCount, setAcademiaCount] = useState<number>(0);
  const [additionalValue, setAdditionalValue] = useState<number>(0);
  const [isDiscount, setIsDiscount] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line
      setShowDeleteConfirm(false);
      setExternalVisitors([]);
      setNewVisitorName("");
      setVisitorSearch("");
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*');
    setStudents(data || []);

    let currentGroupStudents: string[] = [];

    if (agendaItem.type === 'group') {
      const { data: gsData } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', agendaItem.id);
      currentGroupStudents = (gsData || []).map((gs: any) => gs.student_id);
      setGroupStudents(currentGroupStudents);
    }

    if (agendaItem.session) {
      // Session already exists
      let existingAttendees: string[] = [];
      let existingPaid = false;
      let existingCount = 0;
      let existingAdditionalValue = 0;
      let existingExternalVisitors: string[] = [];
      
      if (Array.isArray(agendaItem.session.attendee_ids)) {
        existingAttendees = agendaItem.session.attendee_ids;
      } else if (agendaItem.session.attendee_ids) {
        existingAttendees = agendaItem.session.attendee_ids.attendees || [];
        existingPaid = agendaItem.session.attendee_ids.paid || false;
        existingCount = agendaItem.session.attendee_ids.academia_count || 0;
        existingAdditionalValue = agendaItem.session.attendee_ids.additional_value || 0;
        existingExternalVisitors = agendaItem.session.attendee_ids.external_visitors || [];
      }

      setPresentStudents(existingAttendees);
      setIsPaid(existingPaid);
      setAcademiaCount(existingCount);
      if (existingAdditionalValue < 0) {
        setIsDiscount(true);
        setAdditionalValue(Math.abs(existingAdditionalValue));
      } else {
        setIsDiscount(existingAdditionalValue === 0 ? true : false);
        setAdditionalValue(existingAdditionalValue);
      }
      setExternalVisitors(existingExternalVisitors);
    } else {
      // New session
      setIsPaid(false);
      setAcademiaCount(0);
      setAdditionalValue(0);
      setIsDiscount(true);
      setExternalVisitors([]);
      if (agendaItem.type === 'student') {
        setPresentStudents([agendaItem.id]);
      } else if (agendaItem.type === 'group' && agendaItem.class_category !== 'academia') {
        setPresentStudents(currentGroupStudents);
      } else {
        setPresentStudents([]);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted && isOpen && agendaItem) {
        await fetchStudents();
      }
    };
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, agendaItem]);

  const handleTogglePresence = (studentId: string) => {
    setPresentStudents(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleAddExternalVisitor = () => {
    if (newVisitorName.trim()) {
      setExternalVisitors(prev => [...prev, newVisitorName.trim()]);
      setNewVisitorName("");
    }
  };

  const handleRemoveExternalVisitor = (index: number) => {
    setExternalVisitors(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const sessionData = {
      attendees: presentStudents,
      external_visitors: externalVisitors,
      paid: isPaid,
      academia_count: academiaCount,
      additional_value: (() => {
        const val = typeof (additionalValue as any) === 'string' 
          ? parseFloat((additionalValue as any).replace(',', '.')) || 0 
          : additionalValue;
        return isDiscount ? -Math.abs(val) : Math.abs(val);
      })(),
      class_time: agendaItem.time,
      isOneOff: !!agendaItem.scheduleItem?.isOneOff
    };

    try {
      let existingSessionId = agendaItem.session?.id;

      if (!existingSessionId) {
        // Double check in the database if a session for this item already exists today (local-day UTC window)
        const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
        const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
        
        const { data: existingSessions, error: findError } = await supabase
          .from('sessions')
          .select('*')
          .eq('reference_id', agendaItem.id)
          .eq('type', agendaItem.type)
          .gte('date', todayStart)
          .lte('date', todayEnd);
          
        if (!findError && existingSessions && existingSessions.length > 0) {
          // Let's find one that matches the class_time, or default to the first one
          const matchingSession = existingSessions.find((s: any) => {
            const classTime = s.attendee_ids?.class_time;
            return classTime === agendaItem.time || (!classTime && !agendaItem.scheduleItem?.isOneOff);
          }) || existingSessions[0];
          
          existingSessionId = matchingSession.id;
          
          // Let's also find duplicates (sessions for the same student/group on the same day and same class_time)
          // and delete them to clean up the user's duplicated payments!
          const duplicates = existingSessions.filter((s: any) => {
            if (s.id === existingSessionId) return false;
            const classTime = s.attendee_ids?.class_time;
            return classTime === agendaItem.time || (!classTime && !agendaItem.scheduleItem?.isOneOff);
          });
          
          if (duplicates.length > 0) {
            const duplicateIds = duplicates.map(s => s.id);
            await supabase
              .from('sessions')
              .delete()
              .in('id', duplicateIds);
          }
        }
      }

      if (existingSessionId) {
        // Update existing session
        const { error } = await supabase
          .from('sessions')
          .update({ attendee_ids: sessionData, status: 'completed' })
          .eq('id', existingSessionId);
        if (error) throw error;
      } else {
        // Create new session
        const { error } = await supabase.from('sessions').insert({
          type: agendaItem.type,
          reference_id: agendaItem.id,
          date: date.toISOString(),
          status: 'completed',
          attendee_ids: sessionData
        });
        if (error) throw error;
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!agendaItem.session) return;
    setIsSaving(true);
    try {
      if (agendaItem.session.status === 'rescheduled') {
        const table = agendaItem.type === 'group' ? 'groups' : 'students';
        const { data, error: fetchError } = await supabase
          .from(table)
          .select('schedule')
          .eq('id', agendaItem.id)
          .single();
          
        if (!fetchError && data) {
          let schedule = data.schedule || [];
          const toDate = agendaItem.session.attendee_ids?.rescheduledToDate;
          const toTime = agendaItem.session.attendee_ids?.rescheduledToTime;
          
          if (toDate && toTime) {
            schedule = schedule.filter((s: any) => !(s.isOneOff && s.date === toDate && s.time === toTime));
            
            await supabase
              .from(table)
              .update({ schedule })
              .eq('id', agendaItem.id);
          }
        }
      }

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', agendaItem.session.id);
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePermanently = async () => {
    const isOneOff = agendaItem.scheduleItem?.isOneOff;
    
    setIsSaving(true);
    try {
      const table = agendaItem.type === 'group' ? 'groups' : 'students';
      
      // 1. Buscando schedule atual
      const { data, error: fetchError } = await supabase
        .from(table)
        .select('schedule')
        .eq('id', agendaItem.id)
        .single();
        
      if (fetchError) throw fetchError;
      
      let schedule = data.schedule || [];
      
      if (isOneOff) {
        // Remove a aula pontual específica
        schedule = schedule.filter((s: any) => !(
          s.isOneOff && 
          s.date === agendaItem.scheduleItem.date && 
          s.time === agendaItem.time
        ));
      } else {
        // Remove o horário fixo
        const itemDayOfWeek = agendaItem.scheduleItem?.dayOfWeek;
        schedule = schedule.filter((s: any) => !(
          !s.isOneOff && 
          s.dayOfWeek === itemDayOfWeek && 
          s.time === agendaItem.time
        ));
      }
      
      // 2. Atualiza a tabela
      const { error: updateError } = await supabase
        .from(table)
        .update({ schedule })
        .eq('id', agendaItem.id);
        
      if (updateError) throw updateError;
      
      // 3. Deleta sessões associadas a esta aula no mesmo dia/horário para limpeza completa
      if (agendaItem.session?.id) {
        await supabase
          .from('sessions')
          .delete()
          .eq('id', agendaItem.session.id);
      } else {
        // Find and delete the session specifically matching this class
        const dateStr = getLocalDateString(date);
        const { data: matchedSessions } = await supabase
          .from('sessions')
          .select('id, attendee_ids')
          .eq('reference_id', agendaItem.id)
          .eq('type', agendaItem.type)
          .filter('date', 'gte', `${dateStr}T00:00:00`)
          .filter('date', 'lte', `${dateStr}T23:59:59`);
          
        if (matchedSessions && matchedSessions.length > 0) {
          const idsToDelete = matchedSessions
            .filter(s => s.attendee_ids?.class_time === agendaItem.time && !!s.attendee_ids?.isOneOff === !!isOneOff)
            .map(s => s.id);
          
          if (idsToDelete.length > 0) {
            await supabase
              .from('sessions')
              .delete()
              .in('id', idsToDelete);
          }
        }
      }

      // If we are deleting a one-off class, it might have been created by a reschedule.
      // We should find the original "rescheduled" session that points to this one-off class and delete it,
      // so the original class reverts to normal.
      if (isOneOff) {
        const { data: rescheduledSessions } = await supabase
          .from('sessions')
          .select('id, attendee_ids')
          .eq('reference_id', agendaItem.id)
          .eq('type', agendaItem.type)
          .eq('status', 'rescheduled');

        if (rescheduledSessions && rescheduledSessions.length > 0) {
          const dateStr = getLocalDateString(date);
          const idsToDelete = rescheduledSessions
            .filter(s => 
              s.attendee_ids?.rescheduledToDate === dateStr && 
              s.attendee_ids?.rescheduledToTime === agendaItem.time
            )
            .map(s => s.id);

          if (idsToDelete.length > 0) {
            await supabase.from('sessions').delete().in('id', idsToDelete);
          }
        }
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir o horário permanentemente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !agendaItem) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-surface-container-lowest w-full md:max-w-[480px] rounded-t-[28px] sm:rounded-[28px] shadow-2xl relative z-10 flex flex-col max-h-[95dvh]">
        <div className="flex justify-between items-center border-b border-outline-variant/30 p-margin-mobile pb-4 shrink-0">
          <div>
            <h3 className="font-headline-sm text-[24px] font-bold text-on-surface">
              {agendaItem.session?.status === 'cancelled' 
                ? 'Aula Cancelada' 
                : agendaItem.session?.status === 'rescheduled'
                ? 'Aula Reagendada'
                : (agendaItem.session ? 'Atualizar Presenças' : 'Confirmar Aula')}
            </h3>
            <p className="font-body-md text-on-surface-variant mt-1">{agendaItem.name} - {agendaItem.time}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container transition-colors shrink-0">
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>
        </div>

        <div className="overflow-y-auto p-margin-mobile pt-4 flex-1">
          {agendaItem.session?.status === 'cancelled' || agendaItem.session?.status === 'rescheduled' ? (
            <p className="text-on-surface-variant mb-4 text-center">
              {agendaItem.session?.status === 'rescheduled'
                ? `Esta aula foi reagendada: ${agendaItem.session?.attendee_ids?.notes || ''}. Deseja desfazer o reagendamento?`
                : 'Esta aula foi marcada como cancelada. Deseja desfazer?'}
            </p>
        ) : (
          <>
            {agendaItem.class_category === 'academia' ? (
              <div className="mb-6">
                <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold mb-3 block">
                  Informações da Academia
                </label>
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-on-surface-variant">Número de alunos presentes (apenas se pago por aluno):</label>
                  <input 
                    type="number" 
                    min="0"
                    value={academiaCount === 0 ? '' : academiaCount} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setAcademiaCount(0);
                      } else {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          setAcademiaCount(parsed);
                        }
                      }
                    }}
                    className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary text-on-surface"
                    placeholder="Deixe 0 se a academia paga por aula"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold mb-3 block">
                    Presentes na Aula
                  </label>
                  <div className="flex flex-col gap-2 pr-1">
                    {students.filter(s => agendaItem.type === 'group' ? (groupStudents.includes(s.id) || presentStudents.includes(s.id)) : (s.id === agendaItem.id || presentStudents.includes(s.id))).map(student => (
                      <div key={student.id} 
                        onClick={() => handleTogglePresence(student.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                          presentStudents.includes(student.id) ? 'bg-primary-container/20 border-primary shadow-sm' : 'bg-surface border-outline-variant/50 hover:bg-surface-container-low'
                        }`}
                      >
                        <span className="font-title-md font-bold text-on-surface">{student.name}</span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                          presentStudents.includes(student.id) ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant text-transparent'
                        }`}>
                          <Check className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold mb-3 block">Adicione visitantes na aula</p>
                  
                  {/* Busca e Adição de Alunos do Sistema */}
                  <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl overflow-hidden mb-4 flex flex-col focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                    <div className="relative border-b border-outline-variant/30">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-on-surface-variant" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 bg-transparent text-on-surface placeholder-on-surface-variant focus:outline-none sm:text-sm font-medium"
                        placeholder="Buscar alunos do sistema..."
                        value={visitorSearch}
                        onChange={(e) => setVisitorSearch(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto p-1.5 bg-surface-container-lowest/50">
                      {students.filter(s => {
                         if (presentStudents.includes(s.id)) return false;
                         if (agendaItem.type === 'student') return s.id !== agendaItem.id;
                         if (agendaItem.type === 'group' && groupStudents.includes(s.id)) return false;
                         return s.name.toLowerCase().includes(visitorSearch.toLowerCase());
                      }).map(student => (
                         <div key={student.id} 
                          onClick={() => {
                            handleTogglePresence(student.id);
                            setVisitorSearch("");
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors group"
                        >
                          <span className="text-sm font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{student.name}</span>
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                      {students.filter(s => {
                         if (presentStudents.includes(s.id)) return false;
                         if (agendaItem.type === 'student') return s.id !== agendaItem.id;
                         if (agendaItem.type === 'group' && groupStudents.includes(s.id)) return false;
                         return s.name.toLowerCase().includes(visitorSearch.toLowerCase());
                      }).length === 0 && (
                        <p className="text-center text-xs text-on-surface-variant p-3 font-medium">Nenhum aluno encontrado.</p>
                      )}
                    </div>
                  </div>

                  {/* Lista de Visitantes Externos Adicionados */}
                  {externalVisitors.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                      <p className="font-label-sm text-on-surface-variant font-medium">Visitantes Externos:</p>
                      {externalVisitors.map((visitor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border bg-surface-container-lowest border-outline-variant/50">
                          <span className="text-sm font-bold text-on-surface">{visitor}</span>
                          <button onClick={() => handleRemoveExternalVisitor(idx)} className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adição de Visitante Externo */}
                  <div className="relative border border-outline-variant/50 rounded-xl bg-surface-container-lowest overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                    <input
                      type="text"
                      className="block w-full pl-4 pr-14 py-3 bg-transparent text-on-surface placeholder-on-surface-variant focus:outline-none sm:text-sm font-medium"
                      placeholder="Visitante de fora do sistema..."
                      value={newVisitorName}
                      onChange={(e) => setNewVisitorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExternalVisitor();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddExternalVisitor}
                      disabled={!newVisitorName.trim()}
                      className="absolute inset-y-0 right-1 my-1 px-3 bg-secondary/10 text-secondary font-bold rounded-lg disabled:opacity-50 hover:bg-secondary hover:text-on-secondary transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold mb-3 block">
                    Ajuste de Valor (Desconto ou Acréscimo)
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => setIsDiscount(true)}
                        className={`py-2.5 px-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                          isDiscount 
                            ? 'bg-error/10 text-error border-error shadow-sm' 
                            : 'bg-surface border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        Desconto (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDiscount(false)}
                        className={`py-2.5 px-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                          !isDiscount 
                            ? 'bg-primary/10 text-primary border-primary shadow-sm' 
                            : 'bg-surface border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        Acréscimo (+)
                      </button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className={`font-bold text-sm ${isDiscount ? 'text-error' : 'text-primary'}`}>
                          {isDiscount ? '- R$' : '+ R$'}
                        </span>
                      </div>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={additionalValue === 0 ? '' : additionalValue || ''} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.,]/g, '');
                          setAdditionalValue(val as any);
                        }}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value.replace(',', '.'));
                          setAdditionalValue(isNaN(val) ? 0 : val);
                        }}
                        className={`w-full bg-surface py-3 pl-14 pr-4 rounded-xl border transition-all focus:outline-none focus:ring-1 text-on-surface ${
                          isDiscount 
                            ? 'border-outline-variant focus:border-error focus:ring-error' 
                            : 'border-outline-variant focus:border-primary focus:ring-primary'
                        }`}
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {isDiscount 
                        ? 'O valor inserido será subtraído como desconto (ex: o aluno faltou).' 
                        : 'O valor inserido será somado como acréscimo.'}
                    </p>
                  </div>
                </div>
              </>
            )}
             <div className="mb-2">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest">
                <input 
                  type="checkbox" 
                  checked={isPaid} 
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded border-outline"
                />
                <span className="font-title-sm font-bold text-on-surface">Aula já foi paga?</span>
              </label>
            </div>
          </>
        )}
        </div>
        
        {/* Footer actions fixed at bottom */}
        <div className="p-margin-mobile pt-4 border-t border-outline-variant/30 bg-surface-container-lowest shrink-0">
          {agendaItem.session?.status === 'cancelled' || agendaItem.session?.status === 'rescheduled' ? (
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteSession}
                disabled={isSaving}
                className="w-full bg-primary text-on-primary font-label-lg py-4 rounded-full flex justify-center items-center font-bold hover:bg-primary/90 transition-colors"
              >
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : agendaItem.session?.status === 'rescheduled' ? 'Desfazer Reagendamento' : 'Desfazer Cancelamento'}
              </button>
              {!showDeleteConfirm ? (
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="w-full flex justify-center items-center gap-2 text-error/80 font-label-md hover:text-error hover:underline transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Excluir permanentemente da agenda
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-error-container/20 border border-error-container rounded-xl">
                  <span className="text-sm font-medium text-error text-center">
                    Tem certeza que deseja apagar permanentemente?
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowDeleteConfirm(false)} 
                      className="flex-1 py-2 font-label-md font-bold text-on-surface bg-surface-container rounded-full"
                    >
                      Não
                    </button>
                    <button 
                      onClick={handleDeletePermanently} 
                      disabled={isSaving}
                      className="flex-1 py-2 flex justify-center items-center gap-2 font-label-md font-bold text-on-error bg-error rounded-full disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, Apagar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-primary text-on-primary font-label-lg py-4 rounded-full flex justify-center items-center font-bold hover:bg-primary/90 transition-colors"
              >
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (agendaItem.session ? 'Salvar Alterações' : 'Confirmar Presenças e Concluir')}
              </button>
              
              <button 
                onClick={onClose}
                disabled={isSaving}
                className="w-full bg-surface-container-high text-on-surface font-label-lg py-3 rounded-full flex justify-center items-center font-bold hover:bg-surface-container-highest transition-colors"
              >
                Voltar
              </button>
              
              {agendaItem.session && (
                <button 
                  onClick={handleDeleteSession}
                  disabled={isSaving}
                  className="w-full bg-error-container text-on-error-container font-label-lg py-3 rounded-full flex justify-center items-center font-bold hover:bg-error hover:text-on-error transition-colors"
                >
                  Desfazer Aula e Remover Confirmação
                </button>
              )}
              {!showDeleteConfirm ? (
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="w-full flex justify-center items-center gap-2 text-error/80 font-label-md hover:text-error hover:underline transition-all mt-2"
                >
                  <Trash2 className="w-4 h-4" /> Excluir permanentemente
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-error-container/20 border border-error-container rounded-xl">
                  <span className="text-sm font-medium text-error text-center">
                    Tem certeza que deseja apagar permanentemente?
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowDeleteConfirm(false)} 
                      className="flex-1 py-2 font-label-md font-bold text-on-surface bg-surface-container rounded-full"
                    >
                      Não
                    </button>
                    <button 
                      onClick={handleDeletePermanently} 
                      disabled={isSaving}
                      className="flex-1 py-2 flex justify-center items-center gap-2 font-label-md font-bold text-on-error bg-error rounded-full disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, Apagar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
