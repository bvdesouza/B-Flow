'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { DollarSign, AlertCircle, ArrowUpRight, ArrowDownRight, CheckSquare, ChevronLeft, ChevronRight, Loader2, Info, Pencil, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StudentFinanceModal } from '@/components/StudentFinanceModal';
import { useFinance } from '@/components/FinanceContext';

type MonthData = {
  name: string;
  recebido: number;
  aReceber: number;
  total: number;
  dateStr: string;
};

export default function Relatorios() {
  const { formatCurrency, isFinanceVisible } = useFinance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthData[]>([]);
  const [dailyChartData, setDailyChartData] = useState<MonthData[]>([]);
  
  const [stats, setStats] = useState({
    receitaBruta: 0,
    aReceber: 0,
    alunosPendentes: 0,
    taxaPresenca: 0,
    receitaGrowth: 0, // % growth vs last month
  });

  const [studentDetails, setStudentDetails] = useState<any[]>([]);
  const [financeModalStudent, setFinanceModalStudent] = useState<any | null>(null);

  const fetchRelatoriosData = async () => {
    setIsLoading(true);
    try {
      const { data: studentsData } = await supabase.from('students').select('*');
      const { data: groupsData } = await supabase.from('groups').select('*');
      const { data: groupStudentsData } = await supabase.from('group_students').select('*');
      const { data: plansData } = await supabase.from('plans').select('*');
      
      // We need sessions for the last 6 months for the chart, 
      // and for the selected month for the detailed stats.
      // Let's fetch the last 7 months to calculate growth.
      
      const targetMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const targetMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      
      const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
      const sevenMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 6, 1);

      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', sevenMonthsAgo.toISOString())
        .lte('date', targetMonthEnd.toISOString());

      if (!studentsData || !groupsData || !plansData || !sessionsData) return;

      // 1. Chart Data (last 6 months up to currentDate month)
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const newChartData: MonthData[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const mStart = d;
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        
        const mSessions = sessionsData.filter(s => {
          const sDate = new Date(s.date);
          return sDate >= mStart && sDate <= mEnd && s.status === 'completed';
        });
        
        let monthRecebido = 0;
        let monthAReceber = 0;
        
        // Similar logic to dashboard for Revenue Calculation
        const monthlyProcessed = new Set<string>();
        
        // First process monthly plans
        studentsData.forEach(student => {
          const plan = plansData.find(p => p.id === student.plan_id);
          if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
            const hasCompleted = mSessions.some(s => s.reference_id === student.id && s.type === 'student');
            const hasPaid = mSessions.some(s => s.reference_id === student.id && s.type === 'student' && s.attendee_ids?.paid === true);
            if (hasCompleted) {
              if (hasPaid) monthRecebido += Number(plan.price);
              else monthAReceber += Number(plan.price);
              monthlyProcessed.add(student.id);
            }
          }
        });
        
        groupsData.forEach(group => {
          const plan = plansData.find(p => p.id === group.plan_id);
          if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
             const hasCompleted = mSessions.some(s => s.reference_id === group.id && s.type === 'group');
             const hasPaid = mSessions.some(s => s.reference_id === group.id && s.type === 'group' && s.attendee_ids?.paid === true);
             if (hasCompleted) {
               if (hasPaid) monthRecebido += Number(plan.price);
               else monthAReceber += Number(plan.price);
               monthlyProcessed.add(group.id);
             }
          }
        });

        // Then per-class plans
        mSessions.forEach(session => {
          let attendees: string[] = [];
          let isPaid = session.attendee_ids?.paid || false;
          let academiaCount = session.attendee_ids?.academia_count || 0;
          let additionalValue = session.attendee_ids?.additional_value || 0;
          
          if (Array.isArray(session.attendee_ids)) {
             attendees = session.attendee_ids;
          } else if (session.attendee_ids) {
             attendees = session.attendee_ids.attendees || [];
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
                    const count = academiaCount > 0 ? academiaCount : attendees.length;
                    sessionAmount = Number(plan.price) * count;
                  } else {
                    sessionAmount = Number(plan.price);
                  }
                }
              } else {
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
          
          if (sessionAmount !== 0) {
            if (isPaid) monthRecebido += sessionAmount;
            else monthAReceber += sessionAmount;
          }
        });

        newChartData.push({
          name: monthNames[d.getMonth()],
          recebido: monthRecebido,
          aReceber: monthAReceber,
          total: monthRecebido + monthAReceber,
          dateStr: d.toISOString()
        });
      }
      setChartData(newChartData);

      // Previous Month Revenue for Growth Calc
      const previousMonthData = newChartData[newChartData.length - 2];
      const currentMonthData = newChartData[newChartData.length - 1];
      let growth = 0;
      if (previousMonthData && previousMonthData.recebido > 0) {
        growth = ((currentMonthData.recebido - previousMonthData.recebido) / previousMonthData.recebido) * 100;
      } else if (currentMonthData.recebido > 0) {
        growth = 100;
      }

      // 2. Target Month Details (Selected Month)
      const targetSessions = sessionsData.filter(s => {
        const sDate = new Date(s.date);
        return sDate >= targetMonthStart && sDate <= targetMonthEnd && s.status === 'completed';
      });

      let totalReceitaBruta = 0;
      let totalAReceber = 0;
      let totalPresencas = 0;
      let totalFaltas = 0;
      let pendentesCount = new Set<string>();

      const targetMonthlyProcessed = new Set<string>();
      
      const newStudentDetails: any[] = [];

      const dailyMap = new Map<string, { recebido: number, aReceber: number }>();
      const daysInTargetMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInTargetMonth; i++) {
        dailyMap.set(String(i).padStart(2, '0'), { recebido: 0, aReceber: 0 });
      }

      // Calculate per student
      studentsData.forEach(student => {
        let studentAulas = 0;
        let studentFaltas = 0;
        let studentValor = 0;
        let isPendente = false;

        const plan = plansData.find(p => p.id === student.plan_id);
        const planName = plan ? plan.name : 'Sem plano';
        
        // Find sessions for this student (direct or via group)
        // Group sessions:
        const groupsForStudent = groupStudentsData?.filter(gs => gs.student_id === student.id).map(gs => gs.group_id) || [];
        
        targetSessions.forEach(session => {
          let attendees: string[] = [];
          if (Array.isArray(session.attendee_ids)) {
             attendees = session.attendee_ids;
          } else if (session.attendee_ids) {
             attendees = session.attendee_ids.attendees || [];
          }

          if (session.type === 'student' && session.reference_id === student.id) {
            if (attendees.includes(student.id)) {
              studentAulas++;
              totalPresencas++;
            } else {
              studentFaltas++;
              totalFaltas++;
            }
          } else if (session.type === 'group' && groupsForStudent.includes(session.reference_id)) {
             const group = groupsData.find(g => g.id === session.reference_id);
             if (group && group.class_category !== 'academia') {
               if (attendees.includes(student.id)) {
                 studentAulas++;
                 totalPresencas++;
               } else {
                 studentFaltas++;
                 totalFaltas++;
               }
             }
          }
        });

        // Finance calc for student
        if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
           const firstSession = targetSessions.find(s => s.reference_id === student.id && s.type === 'student' && s.status === 'completed');
           const hasCompleted = !!firstSession;
           const hasPaid = targetSessions.some(s => s.reference_id === student.id && s.type === 'student' && s.attendee_ids?.paid === true);
           
           if (hasCompleted) {
             studentValor = Number(plan.price);
             if (hasPaid) {
               totalReceitaBruta += studentValor;
               if (firstSession) {
                 const dStr = String(new Date(firstSession.date).getDate()).padStart(2, '0');
                 if (dailyMap.has(dStr)) {
                   const current = dailyMap.get(dStr)!;
                   current.recebido += studentValor;
                   dailyMap.set(dStr, current);
                 }
               }
             } else {
               totalAReceber += studentValor;
               isPendente = true;
               pendentesCount.add(student.id);
             }
             targetMonthlyProcessed.add(student.id);
           }
        }

        // Per class calculations will be added from sessions loop

        if (studentAulas > 0 || studentFaltas > 0 || studentValor > 0 || student.status === 'Pendente') {
          // Check if overall status is Pendente as fallback
          if (student.status === 'Pendente') {
             isPendente = true;
             pendentesCount.add(student.id);
          }

          newStudentDetails.push({
             id: student.id,
             name: student.name,
             plan_id: student.plan_id,
             initials: student.name.substring(0, 2).toUpperCase(),
             planName: planName,
             aulas: studentAulas,
             faltas: studentFaltas,
             valor: studentValor, // Will be updated below
             isPendente: isPendente
          });
        }
      });

      // Group Monthly Process (for groups that pay as a whole)
      groupsData.forEach(group => {
         const plan = plansData.find(p => p.id === group.plan_id);
         if (plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
           const firstSession = targetSessions.find(s => s.reference_id === group.id && s.type === 'group' && s.status === 'completed');
           const hasCompleted = !!firstSession;
           const hasPaid = targetSessions.some(s => s.reference_id === group.id && s.type === 'group' && s.attendee_ids?.paid === true);
           
           if (hasCompleted) {
             const val = Number(plan.price);
             if (hasPaid) {
               totalReceitaBruta += val;
               if (firstSession) {
                 const dStr = String(new Date(firstSession.date).getDate()).padStart(2, '0');
                 if (dailyMap.has(dStr)) {
                   const current = dailyMap.get(dStr)!;
                   current.recebido += val;
                   dailyMap.set(dStr, current);
                 }
               }
             } else {
               totalAReceber += val;
               // mark group students as pendentes? 
               groupStudentsData?.filter(gs => gs.group_id === group.id).forEach(gs => pendentesCount.add(gs.student_id));
             }
             targetMonthlyProcessed.add(group.id);
             
             // Try to assign value to first student in group for display purposes if not academia
             if (group.class_category !== 'academia') {
               const firstStudentId = groupStudentsData?.find(gs => gs.group_id === group.id)?.student_id;
               if (firstStudentId) {
                  const sDetail = newStudentDetails.find(s => s.id === firstStudentId);
                  if (sDetail) {
                    sDetail.valor += val;
                    if (!hasPaid) sDetail.isPendente = true;
                  }
               }
             }
           }
         }

          // Count attendances for the group itself
          let groupAulas = 0;
          let groupFaltas = 0;
          targetSessions.forEach(session => {
            if (session.type === 'group' && session.reference_id === group.id) {
               let attendees: string[] = [];
               if (Array.isArray(session.attendee_ids)) attendees = session.attendee_ids;
               else if (session.attendee_ids) attendees = session.attendee_ids.attendees || [];
               
               if (attendees.length > 0) groupAulas++;
               else groupFaltas++;
            }
          });

          if (groupAulas > 0 || groupFaltas > 0) {
            newStudentDetails.push({
               id: group.id,
               name: group.name,
               plan_id: group.plan_id,
               initials: group.name.substring(0, 2).toUpperCase(),
               planName: plan ? plan.name : 'Sem plano',
               aulas: groupAulas,
               faltas: groupFaltas,
               valor: 0, // Will be updated below in per-class calculation, or handled by the monthly check
               isPendente: false,
               isGroup: true
            });
            
            // If it was a monthly plan, assign the value to the group too (for display only)
            const gDetail = newStudentDetails.find(s => s.id === group.id && s.isGroup);
            if (gDetail && plan && (plan.billing_cycle === 'mês' || plan.billing_cycle === 'pacote' || plan.type === 'Pagamento Mensal Fixo' || plan.type === 'Pagamento por pacote')) {
               const firstSession = targetSessions.find(s => s.reference_id === group.id && s.type === 'group' && s.status === 'completed');
               if (firstSession) {
                  gDetail.valor = Number(plan.price);
                  const hasPaid = targetSessions.some(s => s.reference_id === group.id && s.type === 'group' && s.attendee_ids?.paid === true);
                  if (!hasPaid) gDetail.isPendente = true;
               }
            }
          }
      });

      // Per class calculation for Target Month
      targetSessions.forEach(session => {
          let attendees: string[] = [];
          let isPaid = session.attendee_ids?.paid || false;
          let academiaCount = session.attendee_ids?.academia_count || 0;
          let additionalValue = session.attendee_ids?.additional_value || 0;
          
          if (Array.isArray(session.attendee_ids)) {
             attendees = session.attendee_ids;
          } else if (session.attendee_ids) {
             attendees = session.attendee_ids.attendees || [];
          }

          let sessionAmount = 0;

          if (session.type === 'student') {
            if (!targetMonthlyProcessed.has(session.reference_id)) {
              const student = studentsData.find(s => s.id === session.reference_id);
              const plan = plansData.find(p => p.id === student?.plan_id);
              if (plan) {
                 sessionAmount = Number(plan.price);
                 const sDetail = newStudentDetails.find(s => s.id === session.reference_id);
                 if (sDetail) sDetail.valor += sessionAmount;
              }
            }
            sessionAmount += Number(additionalValue);
            const sDetail = newStudentDetails.find(s => s.id === session.reference_id);
            if (sDetail) {
               if (Number(additionalValue) !== 0) sDetail.valor += Number(additionalValue);
               if (!isPaid && sessionAmount > 0) sDetail.isPendente = true;
            }

          } else if (session.type === 'group') {
            const group = groupsData.find(g => g.id === session.reference_id);
            const plan = plansData.find(p => p.id === group?.plan_id);
            if (group && plan) {
              if (group.class_category === 'academia') {
                if (!targetMonthlyProcessed.has(session.reference_id)) {
                  const duration = Number(group.duration) || 1;
                  if (plan.billing_cycle === 'aula' || plan.type === 'Pagamento por aula') {
                    sessionAmount = Number(plan.price) * duration;
                  } else if (plan.billing_cycle === 'aluno' || plan.type === 'Pagamento por aluno') {
                    const count = academiaCount > 0 ? academiaCount : attendees.length;
                    sessionAmount = Number(plan.price) * count;
                  } else {
                    sessionAmount = Number(plan.price);
                  }
                }
              } else {
                if (!targetMonthlyProcessed.has(session.reference_id)) {
                  if (attendees.length > 1) {
                    sessionAmount = Number(plan.price);
                    // Distribute to first attendee for display
                    const sDetail = newStudentDetails.find(s => s.id === attendees[0]);
                    if (sDetail) sDetail.valor += sessionAmount;
                    
                    // Also distribute to the group itself
                    const gDetail = newStudentDetails.find(s => s.id === session.reference_id && s.isGroup);
                    if (gDetail) gDetail.valor += sessionAmount;

                  } else if (attendees.length === 1) {
                    const student = studentsData.find(s => s.id === attendees[0]);
                    const studentPlan = plansData.find(p => p.id === student?.plan_id);
                    if (studentPlan && !targetMonthlyProcessed.has(student.id)) {
                      sessionAmount = Number(studentPlan.price);
                    } else if (!studentPlan) {
                      sessionAmount = Number(plan.price);
                    }
                    const sDetail = newStudentDetails.find(s => s.id === attendees[0]);
                    if (sDetail) sDetail.valor += sessionAmount;
                    
                    // Also distribute to the group itself
                    const gDetail = newStudentDetails.find(s => s.id === session.reference_id && s.isGroup);
                    if (gDetail) gDetail.valor += sessionAmount;
                  }
                }
              }
            }
            sessionAmount += Number(additionalValue);
            if (Number(additionalValue) !== 0 && attendees.length > 0) {
               const sDetail = newStudentDetails.find(s => s.id === attendees[0]);
               if (sDetail) sDetail.valor += Number(additionalValue);
               
               const gDetail = newStudentDetails.find(s => s.id === session.reference_id && s.isGroup);
               if (gDetail) gDetail.valor += Number(additionalValue);
            }
            
            // Mark pending if not paid
            if (!isPaid && sessionAmount > 0) {
              const gDetail = newStudentDetails.find(s => s.id === session.reference_id && s.isGroup);
              if (gDetail) gDetail.isPendente = true;

              attendees.forEach(att => {
                const sDetail = newStudentDetails.find(s => s.id === att);
                if (sDetail) sDetail.isPendente = true;
                pendentesCount.add(att);
              });
            }
          }
          
          if (sessionAmount !== 0) {
             const dStr = String(new Date(session.date).getDate()).padStart(2, '0');
             if (dailyMap.has(dStr)) {
               const current = dailyMap.get(dStr)!;
               if (isPaid) current.recebido += sessionAmount;
               else current.aReceber += sessionAmount;
               dailyMap.set(dStr, current);
             }

             if (isPaid) {
                totalReceitaBruta += sessionAmount;
             } else {
                totalAReceber += sessionAmount;
             }
          }
      });
      
      const newDailyChartData: MonthData[] = [];
      dailyMap.forEach((value, key) => {
         newDailyChartData.push({
           name: key,
           recebido: value.recebido,
           aReceber: value.aReceber,
           total: value.recebido + value.aReceber,
           dateStr: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${key}`
         });
      });
      setDailyChartData(newDailyChartData);

      const taxa = (totalPresencas + totalFaltas) > 0 ? Math.round((totalPresencas / (totalPresencas + totalFaltas)) * 100) : 0;

      setStats({
         receitaBruta: totalReceitaBruta,
         aReceber: totalAReceber,
         alunosPendentes: pendentesCount.size,
         taxaPresenca: taxa,
         receitaGrowth: growth
      });

      // Only show students who had some activity this month or are pending
      setStudentDetails(newStudentDetails.filter(s => s.aulas > 0 || s.faltas > 0 || s.valor > 0 || s.isPendente).sort((a, b) => b.isPendente ? 1 : -1)); // Pendentes no topo

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRelatoriosData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isCurrentMonth = () => {
    const today = new Date();
    return currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const monthNamesFull = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-margin-mobile pt-[80px] pb-[180px] min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="w-full max-w-3xl mx-auto px-margin-mobile pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <div className="mb-stack-lg flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface mb-1">Relatórios</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Acompanhe seu desempenho financeiro.</p>
        </div>
        
        <div className="flex items-center bg-surface-container-low border border-outline-variant rounded-lg p-1">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container rounded-md text-on-surface-variant">
             <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm px-4 text-on-surface">
            {monthNamesFull[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button onClick={handleNextMonth} disabled={isCurrentMonth()} className={`p-2 rounded-md ${isCurrentMonth() ? 'opacity-30' : 'hover:bg-surface-container text-on-surface-variant'}`}>
             <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-stack-lg">
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-primary-container rounded-xl shrink-0">
              <DollarSign className="text-on-primary-container w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5 truncate">Recebido ({monthNamesFull[currentDate.getMonth()].substring(0, 3)})</p>
              <h3 className="font-headline-lg-mobile text-[20px] font-bold text-on-surface truncate">
                {formatCurrency(stats.receitaBruta)}
              </h3>
            </div>
          </div>
          <span className={`flex shrink-0 items-center font-bold text-xs px-2 py-1 rounded-md ${stats.receitaGrowth >= 0 ? 'bg-primary/10 text-primary-fixed-dim' : 'bg-error/10 text-error'}`}>
             {stats.receitaGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
             {stats.receitaGrowth > 0 ? '+' : ''}{stats.receitaGrowth.toFixed(0)}%
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-error-container rounded-xl shrink-0">
              <AlertCircle className="text-on-error-container w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5 truncate">A Receber</p>
              <h3 className="font-headline-lg-mobile text-[20px] font-bold text-on-surface truncate">
                 {formatCurrency(stats.aReceber)}
              </h3>
            </div>
          </div>
          <span className="flex shrink-0 items-center text-error font-bold text-xs bg-error/10 px-2 py-1 rounded-md">
             {stats.alunosPendentes} pendentes
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-secondary-container rounded-xl shrink-0">
              <CheckSquare className="text-on-secondary-container w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5 truncate">Total do Mês</p>
              <h3 className="font-headline-lg-mobile text-[20px] font-bold text-on-surface truncate">
                {formatCurrency(stats.receitaBruta + stats.aReceber)}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-lg mb-stack-lg">
        <section>
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface mb-stack-md">Evolução Mensal</h3>
          <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 border border-outline-variant shadow-sm h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => isFinanceVisible ? `R$ ${value}` : '••••'}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--color-surface-container-high)', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)' }}
                  formatter={(value: any, name: any) => [isFinanceVisible ? `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'R$ ••••', name]}
                />
                <Bar dataKey="recebido" stackId="a" fill="var(--color-primary)" name="Recebido" maxBarSize={40} />
                <Bar dataKey="aReceber" stackId="a" fill="var(--color-error)" radius={[6, 6, 0, 0]} name="A Receber" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface mb-stack-md">Evolução Diária ({['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][currentDate.getMonth()]})</h3>
          <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 border border-outline-variant shadow-sm h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => isFinanceVisible ? `R$ ${value}` : '••••'}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--color-surface-container-high)', opacity: 0.4 }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-outline-variant)', backgroundColor: 'var(--color-surface-container-lowest)' }}
                  formatter={(value: any, name: any) => [isFinanceVisible ? `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'R$ ••••', name]}
                />
                <Bar dataKey="recebido" stackId="a" fill="var(--color-secondary)" name="Recebido" maxBarSize={20} />
                <Bar dataKey="aReceber" stackId="a" fill="var(--color-error)" radius={[4, 4, 0, 0]} name="A Receber" maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section>
        <div className="flex justify-between items-center mb-stack-md">
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Detalhamento por Aluno</h3>
        </div>
        
        {studentDetails.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center flex flex-col items-center">
            <Info className="w-8 h-8 text-on-surface-variant mb-2 opacity-50" />
            <p className="font-body-md text-on-surface-variant">Nenhum dado encontrado para este mês.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {studentDetails.map(student => (
              <div key={student.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${student.isPendente ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`}>
                    {student.isGroup ? <Users className="w-5 h-5" /> : student.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 max-w-full">
                      <h4 className="font-label-lg text-label-lg font-bold text-on-surface truncate">{student.name}</h4>
                      {student.isGroup && <span className="font-label-sm text-xs bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant shrink-0">Dupla/Grupo</span>}
                    </div>
                    <p className="font-body-md text-on-surface-variant truncate">{student.planName} • {student.aulas} aulas / {student.faltas} faltas</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:w-auto w-full border-t sm:border-t-0 border-outline-variant pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <div className="text-left sm:text-right">
                    <span className="font-title-lg text-on-surface font-bold">
                      {formatCurrency(student.valor)}
                    </span>
                    {!student.isPendente ? (
                        <p className="text-xs font-bold text-primary mt-0.5 sm:mt-1">Pago</p>
                    ) : (
                        <p className="text-xs font-bold text-error mt-0.5 sm:mt-1">Pendente</p>
                    )}
                  </div>
                  <button onClick={() => setFinanceModalStudent(student)} className="p-2 bg-surface-container sm:bg-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-colors" title="Financeiro & Extrato">
                    <DollarSign className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <StudentFinanceModal 
        isOpen={!!financeModalStudent}
        onClose={() => setFinanceModalStudent(null)}
        student={financeModalStudent}
        onSuccess={() => {
          fetchRelatoriosData();
        }}
      />
    </main>
  );
}

