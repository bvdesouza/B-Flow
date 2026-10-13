'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TrendingUp, Users, CheckSquare, Check, X, Plus, Loader2, CalendarClock, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ClassCheckModal } from '@/components/ClassCheckModal';
import { NewClassModal } from '@/components/NewClassModal';
import { EditClassModal } from '@/components/EditClassModal';
import { NewOneOffClassModal } from '@/components/NewOneOffClassModal';
import { useFinance } from '@/components/FinanceContext';
import { getLocalDateString } from '@/lib/utils';

type AgendaItem = {
  id: string;
  type: 'student' | 'group';
  name: string;
  plan: string;
  time: string;
  class_category?: string;
  sessionStatus?: 'completed' | 'cancelled' | 'rescheduled';
  session?: any;
  scheduleItem?: any;
  originalData?: any;
  image?: string;
  initials?: string;
  planPrice?: number;
  planType?: string;
  chargedPrice?: number;
  attendanceSummary?: string;
};

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function Dashboard() {
  const router = useRouter();
  const { formatCurrency } = useFinance();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [isNewOneOffModalOpen, setIsNewOneOffModalOpen] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [finances, setFinances] = useState({ paid: 0, receivable: 0, dailyPaid: 0, dailyReceivable: 0 });
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [userName, setUserName] = useState<string>('Treinador');
  const today = new Date();

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.preferred_name || user.user_metadata?.full_name || 'Treinador');
      }

      const { data: studentsData } = await supabase.from('students').select('*');
      if (studentsData) setStudentsList(studentsData);
      const { data: groupsData } = await supabase.from('groups').select('*, group_students(student_id)');
      const { data: plansData } = await supabase.from('plans').select('*');
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      const { data: monthSessionsData } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);

      // --- Financial Calculation ---
      let paidThisMonth = 0;
      let receivableThisMonth = 0;
      let paidToday = 0;
      let receivableToday = 0;
      const monthlyProcessed = new Set<string>();
      
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      if (monthSessionsData && plansData && studentsData && groupsData) {
        
        const hasPaidSession = (refId: string) => monthSessionsData.some((s: any) => s.reference_id === refId && s.attendee_ids?.paid === true);
        const hasCompletedSession = (refId: string) => monthSessionsData.some((s: any) => s.reference_id === refId && s.status === 'completed');

        // Process Monthly/Package plans ONCE per month if they have active sessions
        studentsData.forEach(student => {
          const plan = plansData.find(p => p.id === student.plan_id);
          if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
            if (hasCompletedSession(student.id)) {
              if (hasPaidSession(student.id)) {
                paidThisMonth += Number(plan.price);
              } else {
                receivableThisMonth += Number(plan.price);
              }
              monthlyProcessed.add(student.id);
            }
          }
        });

        groupsData.forEach(group => {
          const plan = plansData.find(p => p.id === group.plan_id);
          if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
            if (hasCompletedSession(group.id)) {
              if (hasPaidSession(group.id)) {
                paidThisMonth += Number(plan.price);
              } else {
                receivableThisMonth += Number(plan.price);
              }
              monthlyProcessed.add(group.id);
            }
          }
        });

        // Process sessions for per-class/per-student plans
        monthSessionsData.forEach((session: any) => {
          if (session.status !== 'completed') return;

          let attendees: string[] = [];
          let isPaid = false;
          let academiaCount = 0;
          let additionalValue = 0;
          
          if (Array.isArray(session.attendee_ids)) {
            attendees = session.attendee_ids;
          } else if (session.attendee_ids) {
            attendees = session.attendee_ids.attendees || [];
            isPaid = session.attendee_ids.paid || false;
            academiaCount = session.attendee_ids.academia_count || 0;
            additionalValue = session.attendee_ids.additional_value || 0;
          }

          let sessionAmount = 0;

          if (session.type === 'student') {
            if (!monthlyProcessed.has(session.reference_id)) {
              const student = studentsData.find(s => s.id === session.reference_id);
              const plan = plansData.find(p => p.id === student?.plan_id);
              if (plan) sessionAmount = Number(plan.price);
            }
            sessionAmount += Number(additionalValue);
          } else if (session.type === 'group') {
            const group = groupsData.find(g => g.id === session.reference_id);
            const plan = plansData.find(p => p.id === group?.plan_id);
            
            if (group && plan) {
              if (group.class_category === 'academia') {
                if (!monthlyProcessed.has(session.reference_id)) {
                  const duration = Number(group.duration) || 1;
                  if (plan.billing_cycle === 'aula' || plan.type === 'Pagamento por aula') {
                    sessionAmount = Number(plan.price) * duration;
                  } else if (plan.billing_cycle === 'aluno' || plan.type === 'Pagamento por aluno') {
                    // Per student
                    const count = academiaCount > 0 ? academiaCount : attendees.length;
                    sessionAmount = Number(plan.price) * count;
                  } else {
                    sessionAmount = Number(plan.price);
                  }
                }
              } else {
                // Normal group/dupla
                if (!monthlyProcessed.has(session.reference_id)) {
                  if (attendees.length > 1) {
                    sessionAmount = Number(plan.price);
                  } else if (attendees.length === 1) {
                    const student = studentsData.find(s => s.id === attendees[0]);
                    const studentPlan = plansData.find(p => p.id === student?.plan_id);
                    if (studentPlan && !monthlyProcessed.has(student.id)) {
                      sessionAmount = Number(studentPlan.price);
                    } else if (!studentPlan) {
                      sessionAmount = Number(plan.price);
                    }
                  }
                }
              }
            }
            sessionAmount += Number(additionalValue);
          }

          if (sessionAmount > 0) {
            const sDate = new Date(session.date);
            const isToday = sDate >= todayStart && sDate <= todayEnd;
            if (isPaid) {
              paidThisMonth += sessionAmount;
              if (isToday) paidToday += sessionAmount;
            } else {
              receivableThisMonth += sessionAmount;
              if (isToday) receivableToday += sessionAmount;
            }
          }
        });
      }
      setFinances({ paid: paidThisMonth, receivable: receivableThisMonth, dailyPaid: paidToday, dailyReceivable: receivableToday });

      // --- Today's Agenda ---
      const todaySessions = monthSessionsData?.filter(s => {
        const sDate = new Date(s.date);
        return sDate >= todayStart && sDate <= todayEnd;
      }) || [];

      const currentDayOfWeek = today.getDay();
      const formattedDate = getLocalDateString(today);
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
          const schedules = student.schedule || [];
          schedules.filter((s: any) => {
            if (s.isOneOff) return s.date === formattedDate;
            return s.dayOfWeek === currentDayOfWeek;
          }).forEach((s: any) => {
            const planData = plansData?.find(p => p.id === student.plan_id);
            const plan = planData?.name || student.plan;
            const session = todaySessions.find(sess => {
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
              sessionStatus: session?.status,
              session: session,
              scheduleItem: s,
              originalData: student,
              image: student.image,
              initials: student.name.substring(0, 2).toUpperCase(),
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
          const schedules = group.schedule || [];
          schedules.filter((s: any) => {
            if (s.isOneOff) return s.date === formattedDate;
            return s.dayOfWeek === currentDayOfWeek;
          }).forEach((s: any) => {
            const planData = plansData?.find(p => p.id === group.plan_id);
            const plan = planData?.name || group.plan;
            const session = todaySessions.find(sess => {
              if (sess.reference_id !== group.id || sess.type !== 'group') return false;
              const isSessionOneOff = !!sess.attendee_ids?.isOneOff;
              const isTargetOneOff = !!s.isOneOff;
              
              if (sess.attendee_ids?.class_time === s.time) {
                // If both have class_time, they must match isOneOff
                if (sess.attendee_ids.isOneOff !== undefined) {
                  return isSessionOneOff === isTargetOneOff;
                }
                // Backwards compatibility
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
              sessionStatus: session?.status,
              session: session,
              scheduleItem: s,
              originalData: group,
              initials: group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
              planPrice: planData ? Number(planData.price) : undefined,
              planType: planData ? (planData.billing_cycle || planData.type) : undefined,
              chargedPrice,
              attendanceSummary
            });
          });
        });
      }

      // Fallback: Add any recorded sessions for today that were not linked via student/group schedule
      todaySessions.forEach(sess => {
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
                sessionStatus: sess.status,
                session: sess,
                scheduleItem: { time: classTime, isOneOff: true, date: formattedDate },
                originalData: student,
                image: student.image,
                initials: student.name.substring(0, 2).toUpperCase(),
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
                sessionStatus: sess.status,
                session: sess,
                scheduleItem: { time: classTime, isOneOff: true, date: formattedDate },
                originalData: group,
                initials: group.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
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
      console.error("Error fetching dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await fetchDashboardData();
    };
    load();
    const handleFocus = () => { if (mounted) fetchDashboardData(); };
    const handleAgendaUpdated = () => { if (mounted) fetchDashboardData(); };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('agenda-updated', handleAgendaUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('agenda-updated', handleAgendaUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
          date: today.toISOString(),
          status: 'cancelled',
          attendee_ids: { class_time: item.time, isOneOff: !!item.scheduleItem?.isOneOff }
        });
        if (error) throw error;
      }
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="w-full max-w-3xl mx-auto px-margin-mobile pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <section className="mb-stack-lg flex justify-between items-end">
        <div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-1">
            {new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'}, {userName}
          </p>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Visão Geral</h2>
        </div>
        <p className="font-label-lg text-label-lg text-primary">Hoje, {today.getDate()} {MONTHS[today.getMonth()]}</p>
      </section>

      <section className="mb-stack-md md:mb-stack-lg">
        <div className="bg-primary rounded-[20px] md:rounded-[24px] py-3 px-4 md:py-4 md:px-6 text-on-primary shadow-lg relative overflow-hidden animate-fade-in">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-secondary/20 rounded-full blur-xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-row gap-3 md:gap-8 justify-between items-center">
            
            {/* Mensal */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] md:text-xs text-primary-fixed-dim uppercase tracking-wider font-bold mb-1 md:mb-1.5">Mensal</span>
              <div className="flex flex-col gap-0.5 md:gap-1">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[10px] md:text-xs text-white/70">Recebido:</span>
                  <span className="text-xs md:text-sm font-bold text-emerald-300">{formatCurrency(finances.paid)}</span>
                </div>
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[10px] md:text-xs text-white/70">A receber:</span>
                  <span className="text-xs md:text-sm font-bold text-amber-200">{formatCurrency(finances.receivable)}</span>
                </div>
                <div className="flex items-baseline gap-1 pt-1 mt-0.5 border-t border-white/10 flex-wrap">
                  <span className="text-[10px] md:text-xs font-extrabold text-white">Total:</span>
                  <span className="text-xs md:text-sm font-extrabold text-white">{formatCurrency(finances.paid + finances.receivable)}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-16 md:h-20 bg-white/20 shrink-0 self-center"></div>

            {/* Hoje */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] md:text-xs text-primary-fixed-dim uppercase tracking-wider font-bold mb-1 md:mb-1.5">Hoje</span>
              <div className="flex flex-col gap-0.5 md:gap-1">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[10px] md:text-xs text-white/70">Recebido:</span>
                  <span className="text-xs md:text-sm font-bold text-emerald-300">{formatCurrency(finances.dailyPaid)}</span>
                </div>
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[10px] md:text-xs text-white/70">A receber:</span>
                  <span className="text-xs md:text-sm font-bold text-amber-200">{formatCurrency(finances.dailyReceivable)}</span>
                </div>
                <div className="flex items-baseline gap-1 pt-1 mt-0.5 border-t border-white/10 flex-wrap">
                  <span className="text-[10px] md:text-xs font-extrabold text-white">Total:</span>
                  <span className="text-xs md:text-sm font-extrabold text-white">{formatCurrency(finances.dailyPaid + finances.dailyReceivable)}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-on-primary/20 p-2 md:p-3 rounded-xl backdrop-blur-sm self-center hidden md:block shrink-0">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-on-primary" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-stack-lg">
        <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-4 shadow-sm border border-surface-container flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-secondary-container rounded-xl shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-on-secondary-container" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-[10px] sm:text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-0.5 truncate">Aulas Hoje</span>
            <span className="font-headline-lg-mobile text-[20px] sm:text-[24px] text-on-surface font-bold leading-none truncate">{items.length}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-4 shadow-sm border border-surface-container flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-tertiary-container rounded-xl shrink-0">
            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 text-on-tertiary-container" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-[10px] sm:text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-0.5 truncate">Realizadas</span>
            <span className="font-headline-lg-mobile text-[20px] sm:text-[24px] text-on-surface font-bold leading-none truncate">{items.filter(i => i.sessionStatus === 'completed').length}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-stack-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Próximas Aulas</h3>
          <Link href="/agenda" className="font-label-lg text-label-lg text-primary hover:underline">Ver todas</Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 text-center text-on-surface-variant">
            Nenhuma aula agendada para hoje.
          </div>
        ) : items.map((item, idx) => (
          <div key={`${item.id}-${idx}`} 
               onClick={() => { setSelectedItem(item); setIsEditClassModalOpen(true); }}
               className={`bg-surface-container-lowest rounded-xl p-3 flex items-center justify-between border border-surface-container shadow-sm transition-colors cursor-pointer ${
            item.sessionStatus === 'completed' ? 'opacity-80 border-primary/20 hover:bg-surface-container-low' : 
            item.sessionStatus === 'cancelled' ? 'opacity-50 border-error/20 hover:bg-surface-container-low' : 
            item.sessionStatus === 'rescheduled' ? 'border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' : 
            'hover:border-primary-container/50'
          }`}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`${
                item.type === 'group' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface'
              } rounded-lg flex flex-col items-center justify-center w-11 h-11 font-bold shrink-0`}>
                <span className="font-label-md text-label-md leading-none">{item.time.split(':')[0]}</span>
                <span className="font-label-sm text-[10px] opacity-80 leading-none">{item.time.split(':')[1]}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`font-title-md md:font-title-lg text-on-surface font-semibold truncate ${item.sessionStatus === 'cancelled' ? 'line-through opacity-60' : ''}`}>{item.name}</span>
                <div className="font-body-sm md:font-body-md text-on-surface-variant truncate flex items-center gap-1.5 flex-wrap">
                  <span>{item.type === 'group' ? (item.class_category === 'academia' ? 'Academia' : 'Personal/Grupo') : 'Individual'} • {item.plan}</span>
                  {item.sessionStatus === 'completed' && item.chargedPrice !== undefined ? (
                    <span className="text-primary font-medium text-xs bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      Cobrado: R$ {item.chargedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : item.planPrice !== undefined && (
                    <span className="text-primary font-medium text-xs bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                      R$ {item.planPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {item.planType === 'aula' || item.planType === 'Pagamento por aula' ? '/aula' : 
                       item.planType === 'aluno' || item.planType === 'Pagamento por aluno' ? '/aluno' :
                       item.planType === 'pacote' || item.planType === 'Pagamento por pacote' ? '/pacote' :
                       '/mês'}
                    </span>
                  )}
                </div>
                {item.sessionStatus === 'completed' && item.attendanceSummary && (
                  <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded mt-1.5 w-max line-clamp-1 max-w-[200px] md:max-w-xs" title={item.attendanceSummary}>
                    {item.attendanceSummary}
                  </span>
                )}
                {item.sessionStatus === 'rescheduled' && item.session?.attendee_ids?.notes && (
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/40 px-2 py-0.5 rounded mt-1.5 w-max">
                    {item.session.attendee_ids.notes}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0 ml-2">
              {!item.sessionStatus ? (
                <div className="flex items-center gap-1.5 md:gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsModalOpen(true); }} className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-container text-on-primary-container hover:bg-primary transition-colors"><Check className="w-4 h-4 md:w-5 md:h-5"/></button>
                  <button onClick={(e) => { e.stopPropagation(); handleCancelClass(item); }} className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-on-error transition-colors"><X className="w-4 h-4 md:w-5 md:h-5"/></button>
                </div>
              ) : (
                <div 
                  onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsModalOpen(true); }}
                  className="px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer hover:bg-surface-container-high transition-colors animate-fade-in"
                  title="Clique para desfazer"
                >
                  {item.sessionStatus === 'completed' ? (
                    <span className="text-primary flex items-center gap-1"><Check className="w-3 h-3 md:w-4 md:h-4"/> Feita</span>
                  ) : item.sessionStatus === 'rescheduled' ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><CalendarClock className="w-3 h-3 md:w-4 md:h-4"/> Reagendada</span>
                  ) : (
                    <span className="text-error flex items-center gap-1"><X className="w-3 h-3 md:w-4 md:h-4"/> Cancelada</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

      </section>

      <ClassCheckModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
        agendaItem={selectedItem}
        date={today}
        onSuccess={fetchDashboardData}
      />

      <EditClassModal 
        isOpen={isEditClassModalOpen}
        onClose={() => { setIsEditClassModalOpen(false); setSelectedItem(null); }}
        agendaItem={selectedItem}
        dayOfWeek={today.getDay()}
        currentDate={today}
        onSuccess={fetchDashboardData}
      />

      <NewClassModal
        isOpen={isNewClassModalOpen}
        onClose={() => setIsNewClassModalOpen(false)}
        onSuccess={fetchDashboardData}
      />

      <NewOneOffClassModal
        isOpen={isNewOneOffModalOpen}
        onClose={() => setIsNewOneOffModalOpen(false)}
        onSuccess={fetchDashboardData}
      />

      {/* --- FAB --- */}
      <div className="fixed right-margin-mobile bottom-[100px] md:bottom-margin-tablet md:right-margin-tablet z-40 flex flex-col items-end gap-3">
        {isFabMenuOpen && (
          <div className="flex flex-col gap-3 items-end mb-2 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <button 
              onClick={() => {
                router.push('/alunos?newStudent=true');
                setIsFabMenuOpen(false);
              }}
              className="flex items-center gap-3 bg-surface text-on-surface py-3 px-5 rounded-xl shadow-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="font-label-lg font-bold">Novo Aluno</span>
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <User className="w-5 h-5" />
              </div>
            </button>
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
                <CalendarClock className="w-5 h-5" />
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

