'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users as UsersIcon, X, Loader2, CalendarClock, Trash2, Plus } from 'lucide-react';
import Image from 'next/image';
import { QuickPlanModal, CreatedPlan } from './QuickPlanModal';
import { QuickStudentModal, CreatedStudent, defaultImage } from './QuickStudentModal';

type Plan = {
  id: string;
  name: string;
  is_default: boolean;
  price?: number;
  billing_cycle?: string;
};

type ScheduleItem = {
  dayOfWeek: number;
  time: string;
  isOneOff?: boolean;
  date?: string;
};

type Student = {
  id: string;
  name: string;
  image: string;
  status: string;
  plan_id?: string | null;
  schedule?: ScheduleItem[];
};

type GroupFormData = {
  name: string;
  plan: string;
  plan_id: string | null;
  studentIds: string[];
  schedule: ScheduleItem[];
  class_category: 'individual' | 'personal' | 'academia';
  academiaBillingCycle?: string;
  academiaPrice?: number | string;
  duration?: number | string;
};

interface NewClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewClassModal({ isOpen, onClose, onSuccess }: NewClassModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
  const [isQuickStudentModalOpen, setIsQuickStudentModalOpen] = useState(false);
  const [individualMode, setIndividualMode] = useState<'new' | 'existing'>('new');
  const [individualStudentId, setIndividualStudentId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIndividualMode('new');
      setIndividualStudentId('');
    }
  }, [isOpen]);

  const [groupFormData, setGroupFormData] = useState<GroupFormData>({
    name: '',
    plan: '',
    plan_id: null,
    studentIds: [],
    schedule: [],
    class_category: 'individual',
    academiaBillingCycle: 'aula',
    academiaPrice: 0,
    duration: 1
  });

  const fetchData = async () => {
    try {
      const { data: studentsData } = await supabase.from('students').select('id, name, image, status, plan_id, schedule').order('name');
      const { data: plansData } = await supabase.from('plans').select('*');
      
      if (studentsData) setStudents(studentsData);
      if (plansData) setPlans(plansData);
    } catch (err) {
      console.error("Error fetching data for modal:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted && isOpen) {
        await fetchData();
      }
    };
    load();
    if (isOpen) {
      setTimeout(() => {
        setGroupFormData({
          name: '',
          plan: '',
          plan_id: null,
          studentIds: [],
          schedule: [],
          class_category: 'individual',
          academiaBillingCycle: 'aula',
          academiaPrice: 0,
          duration: 1
        });
        setGroupFormError('');
      }, 0);
    }
    return () => { mounted = false; };
    
  }, [isOpen]);

  const fillScheduleTimes = (schedule: ScheduleItem[]): ScheduleItem[] => schedule.map(s => {
    if (!s.time) {
      const now = new Date();
      return { ...s, time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') };
    }
    return s;
  });

  const handleIndividualSubmit = async () => {
    const schedule = groupFormData.schedule || [];
    if (individualMode === 'new' && !groupFormData.name.trim()) {
      setGroupFormError('Informe o nome do aluno.');
      return;
    }
    if (individualMode === 'existing' && !individualStudentId) {
      setGroupFormError('Selecione o aluno.');
      return;
    }
    if (schedule.length === 0) {
      setGroupFormError('Adicione pelo menos um horário para a aula.');
      return;
    }
    setGroupFormError('');
    setIsSaving(true);
    try {
      const finalSchedule = fillScheduleTimes(schedule);
      if (individualMode === 'new') {
        const selectedPlan = plans.find(p => p.id === groupFormData.plan_id);
        const { error } = await supabase.from('students').insert([{
          name: groupFormData.name.trim(),
          plan: selectedPlan ? selectedPlan.name : '',
          plan_id: groupFormData.plan_id || null,
          status: 'Pago',
          image: defaultImage,
          schedule: finalSchedule
        }]);
        if (error) throw error;
      } else {
        const student = students.find(s => s.id === individualStudentId);
        const oneOffItems = (student && student.schedule ? student.schedule : []).filter(s => s.isOneOff);
        const { error } = await supabase.from('students').update({ schedule: [...finalSchedule, ...oneOffItems] }).eq('id', individualStudentId);
        if (error) throw error;
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving individual class:", err);
      setGroupFormError("Erro ao salvar aula individual.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (groupFormData.class_category === 'individual') {
      await handleIndividualSubmit();
      return;
    }
    if (groupFormData.class_category === 'personal' && groupFormData.studentIds.length < 2) {
      setGroupFormError("Selecione pelo menos 2 alunos para criar a aula em grupo.");
      return;
    }
    setGroupFormError('');
    setIsSaving(true);
    
    try {
      let planId = groupFormData.plan_id;
      let planName = groupFormData.plan;

      const parsedPrice = typeof groupFormData.academiaPrice === 'string' ? parseFloat(groupFormData.academiaPrice.replace(',', '.')) : groupFormData.academiaPrice;
      const finalPrice = (isNaN(parsedPrice as number) ? 0 : parsedPrice) as number;
      const parsedDuration = typeof groupFormData.duration === 'string' ? parseFloat(groupFormData.duration.replace(',', '.')) : groupFormData.duration;
      const finalDuration = (isNaN(parsedDuration as number) ? 1 : parsedDuration) as number;

      if (groupFormData.class_category === 'academia') {
        const { data: planData, error: planError } = await supabase.from('plans').insert({
          name: `Academia: ${groupFormData.name}`,
          type: 'Professor de Sala',
          price: finalPrice,
          billing_cycle: groupFormData.academiaBillingCycle || 'aula'
        }).select();
        
        if (planError) throw planError;
        planId = planData[0].id;
        planName = planData[0].name;
      }

      let finalSchedule = groupFormData.schedule || [];
      if (finalSchedule.length === 0) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        finalSchedule = [{ dayOfWeek, time }];
      } else {
        finalSchedule = finalSchedule.map(s => {
          if (!s.time) {
            const now = new Date();
            const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            return { ...s, time };
          }
          return s;
        });
      }

      const { data: groupData, error: groupError } = await supabase.from('groups').insert([{
         name: groupFormData.name,
         plan: planName,
         plan_id: planId,
         schedule: finalSchedule,
         class_category: groupFormData.class_category,
         status: 'Regular',
         duration: finalDuration
      }]).select();
      if (groupError) throw groupError;
      
      const newGroupId = groupData[0].id;
      
      if (groupFormData.class_category === 'personal' && groupFormData.studentIds.length > 0) {
         await supabase.from('group_students').insert(
           groupFormData.studentIds.map(sid => ({ group_id: newGroupId, student_id: sid }))
         );
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving group:", err);
      setGroupFormError("Erro ao salvar aula em grupo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-outline-variant/30 shrink-0">
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            Nova Aula
          </h3>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleGroupSubmit} className="flex flex-col p-6 gap-5 overflow-y-auto">
          <div className="flex flex-col gap-1.5 border-b border-outline-variant/30 pb-4">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Tipo de Aula</label>
            <select 
              value={groupFormData.class_category || 'personal'}
              onChange={(e) => setGroupFormData({...groupFormData, class_category: e.target.value as 'individual' | 'personal' | 'academia'})}
              className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
            >
              <option value="individual">Individual (1 aluno)</option>
                <option value="personal">Pequeno Grupo</option>
              <option value="academia">Professor de Sala (Academia)</option>
            </select>
          </div>

          {groupFormData.class_category === 'individual' && (
            <div className="flex flex-col gap-3 border border-outline-variant rounded-xl p-4 bg-surface-container-lowest shadow-sm">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIndividualMode('new');
                    setIndividualStudentId('');
                    setGroupFormData(prev => ({ ...prev, name: '', schedule: [] }));
                  }}
                  className={individualMode === 'new' ? 'flex-1 py-2 rounded-lg text-sm font-bold border transition-colors bg-primary text-on-primary border-primary' : 'flex-1 py-2 rounded-lg text-sm font-bold border transition-colors bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'}
                >
                  Novo aluno
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIndividualMode('existing');
                    setIndividualStudentId('');
                    setGroupFormData(prev => ({ ...prev, name: '', schedule: [] }));
                  }}
                  className={individualMode === 'existing' ? 'flex-1 py-2 rounded-lg text-sm font-bold border transition-colors bg-primary text-on-primary border-primary' : 'flex-1 py-2 rounded-lg text-sm font-bold border transition-colors bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container'}
                >
                  Aluno já cadastrado
                </button>
              </div>
              {individualMode === 'new' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Nome do Aluno</label>
                  <input
                    type="text"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-on-surface"
                    placeholder="Ex: João da Silva"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Aluno</label>
                  <select
                    value={individualStudentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setIndividualStudentId(id);
                      const student = students.find(s => s.id === id);
                      const weekly = (student && student.schedule ? student.schedule : []).filter(s => !s.isOneOff);
                      setGroupFormData(prev => ({ ...prev, name: student ? student.name : '', schedule: [...weekly] }));
                    }}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-on-surface"
                  >
                    <option value="" disabled>Selecione um aluno</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-on-surface-variant">Os horários abaixo substituem os horários semanais atuais deste aluno.</p>
                </div>
              )}
            </div>
          )}

          {groupFormData.class_category === 'personal' && (
            <div className="flex flex-col gap-1.5 border border-outline-variant rounded-xl p-4 bg-surface-container-lowest shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
                  Selecionar Alunos (Mínimo 2)
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickStudentModalOpen(true)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Novo Aluno
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mb-3">Selecione quem fará parte desta aula. Você poderá alterar depois.</p>
              
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {students.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <p className="text-sm italic text-on-surface-variant text-center">Nenhum aluno cadastrado.</p>
                    <button
                      type="button"
                      onClick={() => setIsQuickStudentModalOpen(true)}
                      className="text-xs py-1.5 px-3 bg-primary text-on-primary rounded-full font-bold shadow-sm"
                    >
                      + Cadastrar Aluno Agora
                    </button>
                  </div>
                ) : (
                  students.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container cursor-pointer transition-colors border border-transparent hover:border-outline-variant/50">
                      <input 
                        type="checkbox" 
                        checked={groupFormData.studentIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGroupFormData(prev => ({ ...prev, studentIds: [...prev.studentIds, s.id] }));
                          } else {
                            setGroupFormData(prev => ({ ...prev, studentIds: prev.studentIds.filter(id => id !== s.id) }));
                          }
                        }}
                        className="w-4 h-4 shrink-0 text-primary focus:ring-primary rounded border-outline-variant"
                      />
                      <div className="w-8 h-8 rounded-full overflow-hidden relative shrink-0 border border-outline-variant/30">
                        <Image src={s.image} alt={s.name} fill className="object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-sm text-on-surface flex-1 min-w-0 truncate">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {groupFormData.class_category !== 'individual' && (
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Nome da Aula</label>
            <input 
              required
              type="text" 
              value={groupFormData.name}
              onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
              className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
              placeholder={groupFormData.class_category === 'academia' ? "Ex: Sala Musculação Manhã" : "Ex: Funcional Manhã"}
            />
          </div>
          )}

          {(groupFormData.class_category === 'personal' || (groupFormData.class_category === 'individual' && individualMode === 'new')) && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Plano Formato</label>
                <button
                  type="button"
                  onClick={() => setIsQuickPlanModalOpen(true)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Novo Plano
                </button>
              </div>
              {plans.length === 0 ? (
                <div className="flex flex-col items-start gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                  <p className="text-sm text-on-surface-variant">Nenhum plano cadastrado.</p>
                  <button 
                    type="button" 
                    onClick={() => setIsQuickPlanModalOpen(true)} 
                    className="text-sm py-1.5 px-4 bg-primary text-on-primary rounded-full font-bold shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    + Criar Plano Agora
                  </button>
                </div>
              ) : (
                <select 
                  value={groupFormData.plan_id || ''}
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      setIsQuickPlanModalOpen(true);
                    } else {
                      setGroupFormData({...groupFormData, plan_id: e.target.value, plan: plans.find(p => p.id === e.target.value)?.name || ''});
                    }
                  }}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                >
                  <option value="" disabled>Selecione um plano</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="new">+ Cadastrar novo plano...</option>
                </select>
              )}
            </div>
          )}

          {groupFormData.class_category === 'academia' && (
            <div className="flex flex-col gap-4 border border-primary/20 rounded-xl p-4 bg-primary-container/5 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Tipo de Pagamento (Academia)</label>
                <select 
                  value={groupFormData.academiaBillingCycle || 'aula'}
                  onChange={(e) => setGroupFormData({...groupFormData, academiaBillingCycle: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                >
                  <option value="aula">Pago por Aula</option>
                  <option value="aluno">Pago por Aluno Presente</option>
                  <option value="mensal">Fixo Mensal</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Valor Base (R$)</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={groupFormData.academiaPrice === 0 ? '' : groupFormData.academiaPrice || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setGroupFormData({...groupFormData, academiaPrice: val});
                  }}
                  onBlur={(e) => {
                     const val = parseFloat(e.target.value.replace(',', '.'));
                     setGroupFormData({...groupFormData, academiaPrice: isNaN(val) ? 0 : val});
                  }}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                  placeholder="Ex: 44,00"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Duração (Multiplicador)</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={groupFormData.duration || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setGroupFormData({...groupFormData, duration: val});
                  }}
                  onBlur={(e) => {
                     const val = parseFloat(e.target.value.replace(',', '.'));
                     setGroupFormData({...groupFormData, duration: isNaN(val) ? 1 : val});
                  }}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                  placeholder="Ex: 1,5"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-2">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Horários na Agenda (Semanal)
            </label>
            {groupFormData.schedule && groupFormData.schedule.map((item, index) => (
              <div key={index} className="flex gap-2 items-center w-full overflow-hidden">
                <select
                  value={item.dayOfWeek}
                  onChange={(e) => {
                    const newSchedule = [...(groupFormData.schedule || [])];
                    newSchedule[index].dayOfWeek = parseInt(e.target.value);
                    setGroupFormData({ ...groupFormData, schedule: newSchedule });
                  }}
                  className="flex-1 min-w-0 text-sm bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                >
                  <option value={1}>Segunda</option>
                  <option value={2}>Terça</option>
                  <option value={3}>Quarta</option>
                  <option value={4}>Quinta</option>
                  <option value={5}>Sexta</option>
                  <option value={6}>Sábado</option>
                  <option value={0}>Domingo</option>
                </select>
                <input
                  type="time"
                  value={item.time}
                  onChange={(e) => {
                    const newSchedule = [...(groupFormData.schedule || [])];
                    newSchedule[index].time = e.target.value;
                    setGroupFormData({ ...groupFormData, schedule: newSchedule });
                  }}
                  className="w-24 sm:w-32 shrink-0 text-sm bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newSchedule = [...(groupFormData.schedule || [])];
                    newSchedule.splice(index, 1);
                    setGroupFormData({ ...groupFormData, schedule: newSchedule });
                  }}
                  className="p-2 shrink-0 text-error hover:bg-error/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setGroupFormData({ ...groupFormData, schedule: [...(groupFormData.schedule || []), { dayOfWeek: 1, time: '08:00' }] });
              }}
              className="mt-1 text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1 self-start"
            >
              <Plus className="w-4 h-4" /> Adicionar Horário
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 pt-2">
            {groupFormError && (
              <p className="text-error text-xs font-bold text-center w-full mb-2">{groupFormError}</p>
            )}
            <div className="flex gap-3 w-full">
              <button type="button" onClick={onClose} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-md disabled:opacity-50">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-on-primary" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <QuickPlanModal
        isOpen={isQuickPlanModalOpen}
        onClose={() => setIsQuickPlanModalOpen(false)}
        onSuccess={(newPlan: CreatedPlan) => {
          setPlans(prev => [newPlan, ...prev]);
          setGroupFormData(prev => ({
            ...prev,
            plan_id: newPlan.id,
            plan: newPlan.name
          }));
          setIsQuickPlanModalOpen(false);
        }}
      />

      <QuickStudentModal
        isOpen={isQuickStudentModalOpen}
        onClose={() => setIsQuickStudentModalOpen(false)}
        onSuccess={(newStudent: CreatedStudent) => {
          setStudents(prev => [...prev, {
            id: newStudent.id,
            name: newStudent.name,
            image: newStudent.image,
            status: newStudent.status
          }]);
          setGroupFormData(prev => ({
            ...prev,
            studentIds: [...prev.studentIds, newStudent.id]
          }));
          setIsQuickStudentModalOpen(false);
        }}
      />
    </div>
  );
}
