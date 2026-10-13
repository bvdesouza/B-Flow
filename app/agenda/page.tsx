'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Clock, CalendarX, Dumbbell, Users, Loader2, Check, X, Plus, CalendarClock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClassCheckModal } from '@/components/ClassCheckModal';
import { NewClassModal } from '@/components/NewClassModal';
import { EditClassModal } from '@/components/EditClassModal';
import { NewOneOffClassModal } from '@/components/NewOneOffClassModal';
import { getLocalDateString } from '@/lib/utils';

type ScheduleItem = {
  dayOfWeek: number;
  time: string;
  isOneOff?: boolean;
  date?: string;
};

type AgendaItem = {
  id: string;
  type: 'student' | 'group';
  name: string;
  plan: string;
  time: string;
  image?: string;
  initials?: string;
  class_category?: string;
  sessionStatus?: 'completed' | 'cancelled' | 'rescheduled';
  session?: any;
  scheduleItem?: any;
  originalData?: any;
  planPrice?: number;
  planType?: string;
  chargedPrice?: number;
  attendanceSummary?: string;
};

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Agenda() {
  const [bsOpen, setBsOpen] = useState(false);
  const [bsData, setBsData] = useState<AgendaItem | null>(null);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [isNewOneOffModalOpen, setIsNewOneOffModalOpen] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  const fetchAgenda = async () => {
    setIsLoading(true);
    try {
      const { data: studentsData } = await supabase.from('students').select('*');
      const { data: groupsData } = await supabase.from('groups').select('*, group_students(student_id)');
      const { data: plansData } = await supabase.from('plans').select('*');

      const todayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString();
      const todayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59).toISOString();
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', todayStart)
        .lte('date', todayEnd);

      const currentDayOfWeek = selectedDate.getDay();
      const formattedDate = getLocalDateString(selectedDate);
      const newItems: AgendaItem[] = [];

      const getSessionInfo = (session: any, originalData: any, type: string) => {
        if (!session || session.status !== 'completed') return { chargedPrice: undefined, attendanceSummary: undefined };

        let attendees: string[] = [];
        let visitors: string[] = [];
        let additionalValue = 0;
        let academiaCount = 0;
        
        if (Array.isArray(session.attendee_ids)) {
          attendees = session.attendee_ids;
        } else if (session.attendee_ids) {
          attendees = session.attendee_ids.attendees || [];
          visitors = session.attendee_ids.visitors || [];
          additionalValue = session.attendee_ids.additional_value || 0;
          academiaCount = session.attendee_ids.academia_count || 0;
        }

        let sessionAmount = 0;
        let plan = type === 'student' 
          ? plansData?.find(p => p.id === originalData?.plan_id) 
          : plansData?.find(p => p.id === originalData?.plan_id);

        if (type === 'student') {
          if (plan) sessionAmount = Number(plan.price);
          sessionAmount += Number(additionalValue);
        } else if (type === 'group') {
          if (originalData.class_category === 'academia') {
            const duration = Number(originalData.duration) || 1;
            if (plan?.billing_cycle === 'aula' || plan?.type === 'Pagamento por aula') {
              sessionAmount = Number(plan.price) * duration;
            } else if (plan?.billing_cycle === 'aluno' || plan?.type === 'Pagamento por aluno') {
              const count = academiaCount > 0 ? academiaCount : attendees.length;
              sessionAmount = Number(plan.price) * count;
            } else {
              sessionAmount = Number(plan?.price || 0);
            }
          } else {
            if (attendees.length > 1) {
              sessionAmount = Number(plan?.price || 0);
            } else if (attendees.length === 1) {
              const student = studentsData?.find(s => s.id === attendees[0]);
              const studentPlan = plansData?.find(p => p.id === student?.plan_id);
              if (studentPlan) {
                sessionAmount = Number(studentPlan.price);
              } else {
                sessionAmount = Number(plan?.price || 0);
              }
            }
          }
          sessionAmount += Number(additionalValue);
        }

        let attendanceSummary = '';
        if (type === 'student') {
           if (visitors.length > 0) {
             attendanceSummary = `Com visitante: ${visitors.join(', ')}`;
           }
        } else {
           const expectedStudents = originalData.group_students?.map((gs: any) => gs.student_id) || originalData.student_ids || [];
           const presentNames: string[] = [];
           const absentNames: string[] = [];
           
           expectedStudents.forEach((studentId: string) => {
             const student = studentsData?.find(s => s.id === studentId);
             if (student) {
               if (attendees.includes(studentId)) {
                 presentNames.push(student.name.split(' ')[0]);
               } else {
                 absentNames.push(student.name.split(' ')[0]);
               }
             }
           });

           const allNames = [];
           if (presentNames.length > 0 && absentNames.length > 0) {
               allNames.push(`Presentes: ${presentNames.join(', ')}`);
           } else if (presentNames.length > 0 && absentNames.length === 0) {
               allNames.push(`Todos presentes`);
           }
           
           if (absentNames.length > 0) allNames.push(`Faltou: ${absentNames.join(', ')}`);
           if (visitors.length > 0) allNames.push(`Visitante: ${visitors.join(', ')}`);

           attendanceSummary = allNames.join(' | ');
        }

        return { chargedPrice: sessionAmount, attendanceSummary: attendanceSummary || undefined };
      };

      if (studentsData) {
        studentsData.forEach(student => {
          const schedules: ScheduleItem[] = student.schedule || [];
          schedules.filter(s => {
            if (s.isOneOff) return s.date === formattedDate;
            return s.dayOfWeek === currentDayOfWeek;
          }).forEach(s => {
            const planData = plansData?.find(p => p.id === student.plan_id);
            const plan = planData?.name || student.plan;
            const session = sessionsData?.find(sess => {
              if (sess.reference_id !== student.id || sess.type !== 'student') return false;
              const isSessionOneOff = !!sess.attendee_ids?.isOneOff;
              const isTargetOneOff = !!s.isOneOff;
              
              if (sess.attendee_ids?.class_time === s.time) {
                if (sess.attendee_ids.isOneOff !== undefined) {
                  return isSessionOneOff === isTargetOneOff;
                }
                return !isTargetOneOff;
              }
              
              if (isTargetOneOff && sess.attendee_ids?.notes?.includes(s.time)) {
                return true;
              }
              
              if (!isTargetOneOff && !sess.attendee_ids?.class_time) {
                return true;
              }
              
              return false;
            });
            
            const { chargedPrice, attendanceSummary } = getSessionInfo(session, student, 'student');

            newItems.push({
              id: student.id,
              type: 'student',
              name: student.name,
              plan: plan || 'Sem Plano',
              time: s.time,
              image: student.image,
              sessionStatus: session?.status,
              session: session,
              scheduleItem: s,
              originalData: student,
              planPrice: planData ? Number(planData.price) : undefined,
              planType: planData ? (planData.billing_cycle || planData.type) : undefined,
              chargedPrice,
              attendanceSummary
            });
          });
        });
      }

      if (groupsData) {
        groupsData.forEach(group => {
          const schedules: ScheduleItem[] = group.schedule || [];
          schedules.filter(s => {
            if (s.isOneOff) return s.date === formattedDate;
            return s.dayOfWeek === currentDayOfWeek;
          }).forEach(s => {
            const planData = plansData?.find(p => p.id === group.plan_id);
            const plan = planData?.name || group.plan;
            const session = sessionsData?.find(sess => {
              if (sess.reference_id !== group.id || sess.type !== 'group') return false;
              const isSessionOneOff = !!sess.attendee_ids?.isOneOff;
              const isTargetOneOff = !!s.isOneOff;
              
              if (sess.attendee_ids?.class_time === s.time) {
                if (sess.attendee_ids.isOneOff !== undefined) {
                  return isSessionOneOff === isTargetOneOff;
                }
                return !isTargetOneOff;
              }
              
              if (isTargetOneOff && sess.attendee_ids?.notes?.includes(s.time)) {
                return true;
              }
              
              if (!isTargetOneOff && !sess.attendee_ids?.class_time) {
                return true;
              }
              
              return false;
            });
            
            const { chargedPrice, attendanceSummary } = getSessionInfo(session, group, 'group');

            newItems.push({
              id: group.id,
              type: 'group',
              name: group.name,
              plan: plan || 'Sem Plano',
              time: s.time,
              class_category: group.class_category,
              initials: group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
              sessionStatus: session?.status,
              session: session,
              scheduleItem: s,
              originalData: group,
              planPrice: planData ? Number(planData.price) : undefined,
              planType: planData ? (planData.billing_cycle || planData.type) : undefined,
              chargedPrice,
              attendanceSummary
            });
          });
        });
      }

      // Fallback: Add any recorded sessions for selectedDate that were not linked via student/group schedule
      sessionsData?.forEach(sess => {
        const alreadyLinked = newItems.some(item => item.session?.id === sess.id);
        if (!alreadyLinked) {
          const classTime = sess.attendee_ids?.class_time || '08:00';
          if (sess.type === 'student') {
            const student = studentsData?.find(s => s.id === sess.reference_id);
            if (student) {
              const planData = plansData?.find(p => p.id === student.plan_id);
              const plan = planData?.name || student.plan;
              const { chargedPrice, attendanceSummary } = getSessionInfo(sess, student, 'student');
              newItems.push({
                id: student.id,
                type: 'student',
                name: student.name,
                plan: plan || 'Sem Plano',
                time: classTime,
                image: student.image,
                sessionStatus: sess.status,
                session: sess,
                scheduleItem: { time: classTime, isOneOff: true, date: formattedDate },
                originalData: student,
                planPrice: planData ? Number(planData.price) : undefined,
                planType: planData ? (planData.billing_cycle || planData.type) : undefined,
                chargedPrice,
                attendanceSummary
              });
            }
          } else if (sess.type === 'group') {
            const group = groupsData?.find(g => g.id === sess.reference_id);
            if (group) {
              const planData = plansData?.find(p => p.id === group.plan_id);
              const plan = planData?.name || group.plan;
              const { chargedPrice, attendanceSummary } = getSessionInfo(sess, group, 'group');
              newItems.push({
                id: group.id,
                type: 'group',
                name: group.name,
                plan: plan || 'Sem Plano',
                time: classTime,
                class_category: group.class_category,
                initials: group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
                sessionStatus: sess.status,
                session: sess,
                scheduleItem: { time: classTime, isOneOff: true, date: formattedDate },
                originalData: group,
                planPrice: planData ? Number(planData.price) : undefined,
                planType: planData ? (planData.billing_cycle || planData.type) : undefined,
                chargedPrice,
                attendanceSummary
              });
            }
          }
        }
      });

      newItems.sort((a, b) => a.time.localeCompare(b.time));
      setItems(newItems);
    } catch (error) {
      console.error("Error fetching agenda:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await fetchAgenda();
    };
    load();
    const handleFocus = () => { if (mounted) fetchAgenda(); };
    const handleAgendaUpdated = () => { if (mounted) fetchAgenda(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('agenda-updated', handleAgendaUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('agenda-updated', handleAgendaUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, pathname]);

  const openBottomSheet = (item: AgendaItem) => {
    if (!item.initials && !item.image) {
      item.initials = item.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    }
    setBsData(item);
    setBsOpen(true);
  };

  const closeBottomSheet = () => {
    setBsOpen(false);
  };

  const handleCancelClass = async (item: AgendaItem) => {
    try {
      if (item.session) {
        const { error } = await supabase.from('sessions').update({
          status: 'cancelled',
          attendee_ids: { ...item.session.attendee_ids, class_time: item.time, isOneOff: !!item.scheduleItem?.isOneOff }
        }).eq('id', item.session.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sessions').insert({
          type: item.type,
          reference_id: item.id,
          date: selectedDate.toISOString(),
          status: 'cancelled',
          attendee_ids: { class_time: item.time, isOneOff: !!item.scheduleItem?.isOneOff }
        });
        if (error) throw error;
      }
      fetchAgenda();
    } catch (err) {
      console.error(err);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - current.getDay());
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth() && date.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <section className="bg-surface-container-lowest pt-stack-md pb-stack-sm rounded-b-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-stack-lg z-10 relative">
        <div className="px-margin-mobile mb-stack-sm flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
              {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </h2>
            <div className="flex items-center ml-2 bg-surface-container rounded-full">
              <button onClick={handlePrevWeek} className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={handleNextWeek} className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <span 
            onClick={() => setSelectedDate(new Date())}
            className="font-label-lg text-primary cursor-pointer hover:underline font-bold"
          >
            Hoje
          </span>
        </div>
        <div className="flex justify-between overflow-x-auto gap-2 px-margin-mobile pb-2 scrollbar-hide">
          {weekDates.map((date, i) => {
            const selected = isSelected(date);
            const today = isToday(date);
            return (
              <button 
                key={i} 
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col flex-1 min-w-[56px] items-center justify-center py-3 rounded-xl transition-all ${
                  selected 
                    ? 'bg-primary text-on-primary shadow-md transform scale-105 font-bold' 
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className={`font-label-sm text-label-sm uppercase mb-1 ${selected ? 'opacity-90' : ''}`}>{DAYS_OF_WEEK[date.getDay()]}</span>
                <span className={`font-title-lg text-title-lg ${selected ? 'font-bold' : ''}`}>{date.getDate()}</span>
                {today && !selected && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1"></div>}
                {today && selected && <div className="w-1.5 h-1.5 rounded-full bg-on-primary mt-1"></div>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-margin-mobile flex flex-col gap-stack-md flex-1">
        <div className="flex items-center gap-2 text-on-surface-variant mb-2">
          <Clock className="w-5 h-5" />
          <h3 className="font-label-lg text-label-lg uppercase tracking-wider font-bold">Aulas do Dia</h3>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
             <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
             <span className="font-bold text-on-surface-variant">Carregando agenda...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-on-surface-variant">
            <CalendarX className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-bold text-center">Nenhuma aula pendente<br/>para este dia.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const [hour, minute] = item.time.split(':');
            return (
              <div 
                key={`${item.id}-${idx}`}
                onClick={() => { setBsData(item); setIsEditClassModalOpen(true); }}
                className={`bg-surface-container-lowest rounded-xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border flex gap-4 items-center cursor-pointer hover:bg-surface-container-low active:scale-[0.98] transition-all relative overflow-hidden ${
                  item.sessionStatus === 'completed' ? 'opacity-80 border-outline-variant/30' :
                  item.sessionStatus === 'cancelled' ? 'opacity-50 border-outline-variant/30' : 
                  item.sessionStatus === 'rescheduled' ? 'border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' : 
                  'border-outline-variant/30'
                }`}
              >
                {item.type === 'group' && <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.class_category === 'academia' ? 'bg-tertiary' : 'bg-secondary'}`}></div>}
                
                <div className="flex flex-col items-center justify-center w-12 h-12 bg-surface-container rounded-lg shrink-0">
                  <span className="font-title-md text-title-md text-primary leading-none mb-0.5 font-bold">{hour}</span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold">{minute}</span>
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <h4 className={`font-title-md text-[16px] text-on-surface truncate font-bold ${item.sessionStatus === 'cancelled' ? 'line-through text-on-surface-variant' : ''}`}>{item.name}</h4>
                    <div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm mt-0.5">
                      {item.type === 'group' ? <Users className="w-3.5 h-3.5" /> : <Dumbbell className="w-3.5 h-3.5" />}
                      <span className="truncate">
                        {item.type === 'group' 
                          ? (item.class_category === 'academia' ? 'Aula na Academia' : 'Personal/Grupo') 
                          : 'Treino Individual'}
                      </span>
                    </div>
                    {item.sessionStatus === 'completed' && item.attendanceSummary && (
                      <div className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded mt-1.5 w-max line-clamp-1 max-w-[200px] md:max-w-xs" title={item.attendanceSummary}>
                        {item.attendanceSummary}
                      </div>
                    )}
                    {item.sessionStatus === 'rescheduled' && item.session?.attendee_ids?.notes && (
                      <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/40 px-2 py-0.5 rounded mt-1.5 w-max">
                        {item.session.attendee_ids.notes}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 mt-1 sm:mt-0">
                    <div className="flex gap-2">
                      <div className="inline-flex px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded border border-outline-variant/50 text-[10px] font-bold tracking-wide uppercase truncate max-w-[120px]">
                        {item.plan}
                      </div>
                      {item.sessionStatus === 'completed' && item.chargedPrice !== undefined ? (
                        <div className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 text-[10px] font-bold tracking-wide uppercase truncate max-w-[120px]">
                          Cobrado: R$ {item.chargedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      ) : item.planPrice !== undefined && (
                        <div className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 text-[10px] font-bold tracking-wide uppercase truncate max-w-[120px]">
                          R$ {item.planPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {item.planType === 'aula' || item.planType === 'Pagamento por aula' ? '/aula' : 
                           item.planType === 'aluno' || item.planType === 'Pagamento por aluno' ? '/aluno' :
                           item.planType === 'pacote' || item.planType === 'Pagamento por pacote' ? '/pacote' :
                           '/mês'}
                        </div>
                      )}
                    </div>
                    
                    {item.sessionStatus && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); setBsData(item); setBsOpen(true); }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-surface-container-high transition-colors"
                        title="Clique para desfazer"
                      >
                        {item.sessionStatus === 'completed' ? (
                          <span className="text-primary flex items-center gap-1"><Check className="w-3 h-3"/> Feita</span> 
                        ) : item.sessionStatus === 'rescheduled' ? (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Reagendada</span>
                        ) : (
                          <span className="text-error flex items-center gap-1"><X className="w-3 h-3"/> Cancelada</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!item.sessionStatus ? (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openBottomSheet(item); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-colors"><Check className="w-4 h-4"/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleCancelClass(item); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-on-error transition-colors"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-surface bg-surface-container relative">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center font-title-lg text-on-surface-variant bg-surface-container-high font-bold">{item.initials}</span>
                    )}
                  </div>
                )}
                
              </div>
            )
          })
        )}
      </section>

      <ClassCheckModal 
        isOpen={bsOpen}
        onClose={closeBottomSheet}
        agendaItem={bsData}
        date={selectedDate}
        onSuccess={fetchAgenda}
      />

      <EditClassModal 
        isOpen={isEditClassModalOpen}
        onClose={() => { setIsEditClassModalOpen(false); setBsData(null); }}
        agendaItem={bsData}
        dayOfWeek={selectedDate.getDay()}
        currentDate={selectedDate}
        onSuccess={fetchAgenda}
      />

      <NewClassModal
        isOpen={isNewClassModalOpen}
        onClose={() => setIsNewClassModalOpen(false)}
        onSuccess={fetchAgenda}
      />

      <NewOneOffClassModal
        isOpen={isNewOneOffModalOpen}
        onClose={() => setIsNewOneOffModalOpen(false)}
        onSuccess={fetchAgenda}
      />

      {/* --- FAB --- */}
      <div className="fixed right-margin-mobile bottom-[100px] md:bottom-margin-tablet md:right-margin-tablet z-40 flex flex-col items-end gap-3">
        {isFabMenuOpen && (
          <div className="flex flex-col gap-3 items-end mb-2 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <button 
              onClick={() => {
                setIsNewClassModalOpen(true);
                setIsFabMenuOpen(false);
              }}
              className="flex items-center gap-3 bg-surface text-on-surface py-3 px-5 rounded-xl shadow-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="font-label-lg font-bold">Nova Turma / Grupo</span>
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Users className="w-5 h-5" />
              </div>
            </button>
            <button 
              onClick={() => {
                setIsNewOneOffModalOpen(true);
                setIsFabMenuOpen(false);
              }}
              className="flex items-center gap-3 bg-surface text-on-surface py-3 px-5 rounded-xl shadow-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="font-label-lg font-bold">Nova Aula Avulsa</span>
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <User className="w-5 h-5" />
              </div>
            </button>
          </div>
        )}
        <button 
          onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
          className="w-14 h-14 bg-primary text-on-primary rounded-[16px] shadow-lg hover:shadow-xl hover:bg-primary-fixed hover:text-on-primary-fixed transition-all duration-200 flex items-center justify-center active:scale-95"
        >
          {isFabMenuOpen ? <X className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
        </button>
      </div>
    </main>
  );
}
