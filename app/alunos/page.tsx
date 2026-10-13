'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ListFilter, User, Users as UsersIcon, ArrowRight, Plus, X, Pencil, Trash2, Camera, UserMinus, Loader2, CalendarClock, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StudentFinanceModal } from '@/components/StudentFinanceModal';

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
  plan: string;
  plan_id: string | null;
  status: 'Pago' | 'Pendente';
  image: string;
  schedule: ScheduleItem[];
};

type Group = {
  id: string;
  name: string;
  plan: string;
  plan_id: string | null;
  status: 'Pago' | 'Pendente';
  studentIds: string[];
  schedule: ScheduleItem[];
  class_category: 'personal' | 'academia';
  duration: number;
};

const getGroupType = (count: number, category?: string) => {
  if (category === 'academia') return 'Academia';
  if (count <= 2) return 'Dupla';
  if (count === 3) return 'Trio';
  return 'Grupo';
};

const defaultImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuCpERVaTcTn2IrdVA8tDjzOI9kVSv-vA86BxHzc4NYBF7q7w0-mMcIoD8-4W1LHS70Qe2B9iWsYRQbQed3cLVErzktITlsocnwyu15TcIjjmbsKExW9J-76fhopWR6wGSTnN8zR4Jmo5vXxYUcPjJhrX_ATjCohnFl3SNxvmC6kCIHI4i_Dmmx7WGV1km1yjG8grpBEar1TdhanldRbP_jlf47LuGTc0w_Qx6xrGk1NfCTY0jRK2VKYpl_CgznGxp369kxexPj0W_EX";

export default function Alunos() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Student Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [financeModalStudent, setFinanceModalStudent] = useState<Student | null>(null);
  
  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    name: '',
    plan: '',
    plan_id: null,
    status: 'Pago',
    image: defaultImage,
    schedule: [],
  });

  // Group View
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null);

  // FAB
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  const fetchSupabaseData = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase.from('students').select('*').order('created_at', { ascending: false });
      if (studentsError) throw studentsError;
      
      const { data: groupsData, error: groupsError } = await supabase.from('groups').select('*, group_students(student_id)').order('created_at', { ascending: false });
      if (groupsError) throw groupsError;

      const { data: plansData, error: plansError } = await supabase.from('plans').select('id, name, is_default, price, billing_cycle').order('created_at', { ascending: false });
      if (plansError) throw plansError;

      setPlans(plansData || []);
      setStudents((studentsData || []).map((s: any) => ({...s, schedule: s.schedule || []})));
      const mappedGroups: Group[] = (groupsData || []).map((g: any) => {
        const studentIds = g.group_students ? g.group_students.map((gs: any) => gs.student_id) : [];
        const groupStudents = (studentsData || []).filter((s: any) => studentIds.includes(s.id));
        const computedStatus = groupStudents.some((s: any) => s.status === 'Pendente') ? 'Pendente' : 'Pago';
        return {
          id: g.id,
          name: g.name,
          plan: g.plan,
          plan_id: g.plan_id,
          status: computedStatus,
          studentIds,
          schedule: g.schedule || [],
          class_category: g.class_category || 'personal',
          duration: g.duration || 1
        };
      });
      setGroups(mappedGroups);
    } catch (err: any) {
      console.log("Supabase fetch error:", err);
      setFetchError("Não foi possível conectar ao banco de dados Supabase. Verifique suas credenciais na aba Settings (Environment Variables) e certifique-se de que rodou as SQL Migrations.");
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchSupabaseData();
    } else {
      console.warn("Supabase credentials missing, please provide them in the UI");
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const params = new URLSearchParams(window.location.search);
      const editStudentId = params.get('editStudentId');
      const newStudent = params.get('newStudent');
      
      if (editStudentId && students.length > 0) {
        const student = students.find(s => s.id === editStudentId);
        if (student) {
          handleOpenModal(student);
          window.history.replaceState(null, '', '/alunos');
        }
      } else if (newStudent === 'true') {
        handleOpenModal();
        window.history.replaceState(null, '', '/alunos');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, students]);

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.map(g => {
    const groupStudents = g.studentIds.map(id => students.find(s => s.id === id)).filter(Boolean) as Student[];
    const computedStatus = groupStudents.some(s => s.status === 'Pendente') ? 'Pendente' : 'Pago';
    return { ...g, status: computedStatus };
  }).filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    getGroupType(g.studentIds.length, g.class_category).toLowerCase().includes(search.toLowerCase())
  );

  // ---- Student Logic ----

  function handleOpenModal(student?: Student) {
    if (student) {
      setEditingId(student.id);
      setFormData({
        name: student.name,
        plan: student.plan,
        plan_id: student.plan_id,
        status: student.status,
        image: student.image,
        schedule: student.schedule || [],
      });
    } else {
      const defaultPlan = plans.find(p => p.is_default) || plans[0];
      setEditingId(null);
      setFormData({
        name: '',
        plan: '',
        plan_id: defaultPlan ? defaultPlan.id : null,
        status: 'Pago',
        image: defaultImage,
        schedule: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setFormData({ ...formData, image: dataUrl });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalSchedule = formData.schedule || [];
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
      
      const updatedFormData = { ...formData, schedule: finalSchedule };

      if (editingId) {
        const { error } = await supabase.from('students').update(updatedFormData).eq('id', editingId);
        if (error) throw error;
        setStudents(prev => prev.map(s => s.id === editingId ? { ...s, ...updatedFormData } : s));
      } else {
        const { data, error } = await supabase.from('students').insert([updatedFormData]).select();
        if (error) throw error;
        if (data && data[0]) {
          setStudents(prev => [data[0], ...prev]);
        }
      }
      handleCloseModal();
    } catch (err) {
      console.error("Error saving student:", err);
      alert("Erro ao salvar aluno");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Group Logic ----

  const handleDeleteGroup = (id: string) => {
    setDeleteConfirmGroupId(id);
  };

  const handleAddStudentToGroup = async (groupId: string, studentId: string) => {
    try {
      const { error } = await supabase.from('group_students').insert([{ group_id: groupId, student_id: studentId }]);
      if (error) throw error;
      setGroups(prev => prev.map(g => {
        if (g.id === groupId && !g.studentIds.includes(studentId)) {
          return { ...g, studentIds: [...g.studentIds, studentId] };
        }
        return g;
      }));
    } catch (err) {
      console.error("Error adding student:", err);
    }
  };

  const handleUpdateGroupSchedule = async (groupId: string, newSchedule: ScheduleItem[]) => {
    try {
      const { error } = await supabase.from('groups').update({ schedule: newSchedule }).eq('id', groupId);
      if (error) throw error;
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return { ...g, schedule: newSchedule };
        }
        return g;
      }));
    } catch (err) {
      console.error("Error updating group schedule:", err);
    }
  };

  const handleRemoveStudentFromGroup = async (groupId: string, studentId: string) => {
    try {
       const group = groups.find(g => g.id === groupId);
       if (group && group.studentIds.length === 1 && group.studentIds[0] === studentId) {
          // Last student, delete the group
          const { error: deleteGroupError } = await supabase.from('groups').delete().eq('id', groupId);
          if (deleteGroupError) throw deleteGroupError;
          setGroups(prev => prev.filter(g => g.id !== groupId));
          if (viewingGroupId === groupId) setViewingGroupId(null);
       } else {
          const { error } = await supabase.from('group_students').delete().match({ group_id: groupId, student_id: studentId });
          if (error) throw error;
          setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
              return { ...g, studentIds: g.studentIds.filter(id => id !== studentId) };
            }
            return g;
          }));
       }
    } catch (err) {
      console.error("Error removing student:", err);
    }
  };

  if (!isLoaded) return null;

  return (
    <main className="w-full max-w-3xl mx-auto px-margin-mobile pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <div className="relative mb-stack-lg w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
        <input 
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-full py-3 pl-12 pr-12 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm transition-shadow" 
          placeholder="Buscar aluno..." 
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant">
          <ListFilter className="w-5 h-5" />
        </button>
      </div>
      
      {fetchError && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl mb-4 font-bold text-sm">
          {fetchError}
        </div>
      )}

      {/* --- ALUNOS LIST --- */}
      <div className="mb-stack-lg">
        <div className="flex items-center justify-between mb-stack-md">
          <h2 className="font-title-lg text-title-lg text-on-surface flex items-center gap-2 font-bold">
            <User className="text-primary w-6 h-6" />
            Alunos
          </h2>
          <button onClick={() => handleOpenModal()} className="md:hidden flex items-center gap-1 text-primary text-sm font-bold bg-primary/10 px-3 py-1.5 rounded-full">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/50 text-center text-on-surface-variant flex flex-col items-center">
            <User className="w-10 h-10 mb-3 opacity-50" />
            <p className="font-bold">Nenhum aluno encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudents.map(student => (
              <div 
                key={student.id} 
                onClick={() => setFinanceModalStudent(student)}
                className="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant flex items-center justify-between hover:shadow-md hover:bg-surface-container cursor-pointer transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden relative shrink-0 border border-outline-variant/30">
                    <Image src={student.image} alt={student.name} fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                    <div className="min-w-0">
                      <h3 className="font-label-lg text-label-lg font-bold text-on-surface truncate">{student.name}</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant truncate">
                        {!student.plan_id ? <span className="text-error font-bold text-xs bg-error/10 px-2 py-0.5 rounded">⚠️ Sem plano atribuído</span> : plans.find(p => p.id === student.plan_id)?.name || student.plan}
                      </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-label-sm text-label-sm px-2 py-1 rounded-md border font-bold hidden sm:inline-flex ${
                    student.status === 'Pago' 
                      ? 'bg-primary/10 text-primary border-primary/20' 
                      : 'bg-error/10 text-error border-error/20'
                  }`}>
                    {student.status}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(student); }} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-colors" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(student.id); }} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- GRUPOS LIST --- */}
      <div>
        <div className="flex items-center justify-between mb-stack-md mt-stack-lg">
          <h2 className="font-title-lg text-title-lg text-on-surface flex items-center gap-2 font-bold">
            <UsersIcon className="text-primary w-6 h-6" />
            Aulas em Grupo
          </h2>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/50 text-center text-on-surface-variant flex flex-col items-center">
            <UsersIcon className="w-10 h-10 mb-3 opacity-50" />
            <p className="font-bold">Nenhuma aula em grupo encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map(group => {
              const groupStudents = group.studentIds.map(id => students.find(s => s.id === id)).filter(Boolean) as Student[];
              const groupType = getGroupType(groupStudents.length, group.class_category);
              return (
                <div 
                  key={group.id} 
                  onClick={() => { setViewingGroupId(group.id); }}
                  className="bg-surface-container-low rounded-xl p-3 shadow-sm border border-outline-variant/50 relative overflow-hidden group cursor-pointer hover:bg-surface-container transition-colors flex items-center justify-between"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary-container/30 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  
                  <div className="flex flex-col min-w-0 pr-4 relative z-10">
                    <div className="flex gap-2 items-center mb-0.5">
                      <span className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider">{groupType}</span>
                    </div>
                    <h3 className="font-label-lg text-label-lg font-bold text-on-surface truncate">{group.name}</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant truncate">
                      {!group.plan_id ? <span className="text-error font-bold text-xs bg-error/10 px-2 py-0.5 rounded">⚠️ Sem plano atribuído</span> : plans.find(p => p.id === group.plan_id)?.name || group.plan}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 shrink-0 relative z-10">
                    <div className="flex -space-x-3">
                      {groupStudents.slice(0, 3).map((s, idx) => (
                        <div key={idx} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-surface-container-low relative shadow-sm">
                          <Image src={s.image} alt={s.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                      {groupStudents.length > 3 && (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-surface-container-low bg-surface-container-highest flex items-center justify-center text-xs font-bold text-on-surface-variant shadow-sm z-10">
                          +{groupStudents.length - 3}
                        </div>
                      )}
                      {groupStudents.length === 0 && (
                        <span className="text-sm font-bold text-on-surface-variant ml-2 pl-2">Vazio</span>
                      )}
                    </div>
                    
                    <span className={`shrink-0 font-label-sm text-label-sm px-2 py-1 rounded-md border font-bold hidden sm:inline-flex ${
                      group.status === 'Pago' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-error/10 text-error border-error/20'
                    }`}>
                      {group.status}
                    </span>
                    <ArrowRight className="text-on-surface-variant group-hover:text-primary transition-colors w-5 h-5 hidden sm:block" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- FAB --- */}
      <div className="fixed right-margin-mobile bottom-[100px] md:bottom-margin-tablet md:right-margin-tablet z-40 flex flex-col items-end gap-3">
        <button 
          onClick={() => handleOpenModal()}
          className="w-14 h-14 bg-primary text-on-primary rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200 hover:shadow-xl hover:bg-primary/90 active:scale-95"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* --- STUDENT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-outline-variant/30 shrink-0">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {editingId ? 'Editar Aluno' : 'Novo Aluno'}
              </h3>
              <button type="button" onClick={handleCloseModal} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col p-6 gap-5 overflow-y-auto">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden relative shrink-0 border-2 border-surface-container-high">
                  <Image src={formData.image} alt="Preview" fill className="object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <label className="font-label-sm font-bold bg-surface-container hover:bg-surface-container-high cursor-pointer py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 text-on-surface">
                    <Camera className="w-4 h-4" /> Alterar Foto
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <p className="text-[10px] text-on-surface-variant mt-1.5 ml-1">PNG ou JPG</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                  placeholder="Nome do aluno"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Plano</label>
                {plans.length === 0 ? (
                  <div className="flex flex-col items-start gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                    <p className="text-sm text-on-surface-variant">Nenhum plano cadastrado.</p>
                    <button type="button" onClick={() => router.push('/planos')} className="text-sm py-1.5 px-4 bg-primary text-on-primary rounded-full font-bold shadow-sm hover:bg-primary/90 transition-colors">Criar Plano</button>
                  </div>
                ) : (
                  <select 
                    value={formData.plan_id || ''}
                    onChange={(e) => {
                      if (e.target.value === 'new') router.push('/planos');
                      else setFormData({...formData, plan_id: e.target.value, plan: plans.find(p => p.id === e.target.value)?.name || ''});
                    }}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                  >
                    <option value="" disabled>Selecione um plano</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="new">+ Criar novo plano</option>
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Status do Pagamento</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as 'Pago' | 'Pendente'})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                >
                  <option value="Pago">Pago</option>
                  <option value="Pendente">Pendente</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" /> Horários na Agenda (Semanal)
                </label>
                {(formData.schedule?.filter(s => !s.isOneOff) || []).map((item, index) => {
                  const regularSchedules = formData.schedule?.filter(s => !s.isOneOff) || [];
                  const oneOffSchedules = formData.schedule?.filter(s => s.isOneOff) || [];
                  return (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={item.dayOfWeek}
                      onChange={(e) => {
                        const newRegular = [...regularSchedules];
                        newRegular[index].dayOfWeek = parseInt(e.target.value);
                        setFormData({ ...formData, schedule: [...newRegular, ...oneOffSchedules] });
                      }}
                      className="flex-1 bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                    >
                      <option value={1}>Segunda-feira</option>
                      <option value={2}>Terça-feira</option>
                      <option value={3}>Quarta-feira</option>
                      <option value={4}>Quinta-feira</option>
                      <option value={5}>Sexta-feira</option>
                      <option value={6}>Sábado</option>
                      <option value={0}>Domingo</option>
                    </select>
                    <input
                      type="time"
                      value={item.time}
                      onChange={(e) => {
                        const newRegular = [...regularSchedules];
                        newRegular[index].time = e.target.value;
                        setFormData({ ...formData, schedule: [...newRegular, ...oneOffSchedules] });
                      }}
                      className="w-32 bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newRegular = [...regularSchedules];
                        newRegular.splice(index, 1);
                        setFormData({ ...formData, schedule: [...newRegular, ...oneOffSchedules] });
                      }}
                      className="p-2 shrink-0 text-error hover:bg-error/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )})}
                <button
                  type="button"
                  onClick={() => {
                    const oneOffSchedules = formData.schedule?.filter(s => s.isOneOff) || [];
                    const regularSchedules = formData.schedule?.filter(s => !s.isOneOff) || [];
                    setFormData({ ...formData, schedule: [...regularSchedules, { dayOfWeek: 1, time: '08:00' }, ...oneOffSchedules] });
                  }}
                  className="mt-1 text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1 self-start"
                >
                  <Plus className="w-4 h-4" /> Adicionar Horário
                </button>
              </div>

              <div className="mt-4 flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-md disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-on-primary" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- STUDENT MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden p-6 gap-4">
            <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-error" /> Excluir Aluno
            </h3>
            <p className="font-body-md text-on-surface-variant">Tem certeza que deseja excluir este aluno? Ele será removido de todos os grupos e esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 mt-2">
              <button disabled={isSaving} onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button disabled={isSaving} onClick={async () => {
                setIsSaving(true);
                try {
                  const groupsToUpdate = groups.filter(g => g.studentIds.includes(deleteConfirmId));
                  const groupsToDelete = groupsToUpdate.filter(g => g.studentIds.length === 1);

                  const { error } = await supabase.from('students').delete().eq('id', deleteConfirmId);
                  if (error) throw error;
                  
                  if (groupsToDelete.length > 0) {
                    const groupIdsToDelete = groupsToDelete.map(g => g.id);
                    await supabase.from('groups').delete().in('id', groupIdsToDelete);
                  }

                  setStudents(prev => prev.filter(s => s.id !== deleteConfirmId));
                  setGroups(prev => prev
                    .map(g => ({ ...g, studentIds: g.studentIds.filter(id => id !== deleteConfirmId) }))
                    .filter(g => g.studentIds.length > 0)
                  );
                  setDeleteConfirmId(null);
                } catch(err) {
                  console.error("Error deleting student:", err);
                } finally {
                  setIsSaving(false);
                }
              }} className="flex-1 flex justify-center items-center gap-2 py-3 font-label-lg font-bold text-on-error bg-error/10 hover:bg-error/20 border border-error/50 rounded-full transition-colors shadow-sm disabled:opacity-50">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE GROUP CONFIRM MODAL --- */}
      {deleteConfirmGroupId && (() => {
        const groupToDelete = groups.find(g => g.id === deleteConfirmGroupId);
        if (!groupToDelete) return null;
        const groupType = getGroupType(groupToDelete.studentIds.length, groupToDelete.class_category);
        
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden p-6 gap-4">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-error" /> Excluir {groupType}
              </h3>
              <p className="font-body-md text-on-surface-variant">Tem certeza que deseja excluir esta aula em grupo? Os alunos não serão excluídos, apenas a aula deixará de existir.</p>
              <div className="flex gap-3 mt-2">
                <button disabled={isSaving} onClick={() => setDeleteConfirmGroupId(null)} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button disabled={isSaving} onClick={async () => {
                  setIsSaving(true);
                  try {
                    const { error } = await supabase.from('groups').delete().eq('id', deleteConfirmGroupId);
                    if (error) throw error;
                    setGroups(prev => prev.filter(g => g.id !== deleteConfirmGroupId));
                    setDeleteConfirmGroupId(null);
                    setViewingGroupId(null);
                  } catch(err) {
                    console.error("Error deleting group:", err);
                  } finally {
                    setIsSaving(false);
                  }
                }} className="flex-1 flex justify-center items-center gap-2 py-3 font-label-lg font-bold text-on-error bg-error/10 hover:bg-error/20 border border-error/50 rounded-full transition-colors shadow-sm disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- GROUP VIEW MODAL --- */}
      {viewingGroupId && (() => {
        const group = groups.find(g => g.id === viewingGroupId);
        if (!group) return null;
        const groupStudents = group.studentIds.map(id => students.find(s => s.id === id)).filter(Boolean) as Student[];
        const availableStudents = students.filter(s => !group.studentIds.includes(s.id));
        const groupType = getGroupType(groupStudents.length, group.class_category);

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl flex flex-col">
              
              <div className="flex justify-between items-start p-6 border-b border-outline-variant/30 sticky top-0 bg-surface-container-lowest z-10">
                <div className="pointer-events-none absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] z-[-1]"></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-label-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded ${groupType === 'Dupla' ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                      {groupType}
                    </span>
                    <span className={`font-label-sm font-bold px-2 py-0.5 rounded ${group.status === 'Pago' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      {group.status}
                    </span>
                  </div>
                  <h3 className="font-headline-lg-mobile text-[24px] font-bold text-on-surface">{group.name}</h3>
                  <p className="font-body-md text-on-surface-variant font-bold mt-1">
                    {!group.plan_id ? <span className="text-error font-bold text-xs bg-error/10 px-2 py-0.5 rounded">⚠️ Sem plano atribuído</span> : plans.find(p => p.id === group.plan_id)?.name || group.plan}
                  </p>
                </div>
                <button onClick={() => { setViewingGroupId(null); }} className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 border-b border-outline-variant/30 flex justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Categoria</span>
                  <span className="font-title-md font-bold text-on-surface capitalize">{group.class_category}</span>
                </div>
                {group.class_category === 'academia' && (
                  <div className="flex flex-col gap-1 items-end text-right">
                    <span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Duração (h)</span>
                    <span className="font-title-md font-bold text-on-surface">{group.duration || 1}</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-b border-outline-variant/30">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2 mb-4">
                  <h4 className="font-label-lg font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" /> Horários na Agenda (Semanal)
                  </h4>
                </div>
                <div className="flex flex-col gap-3">
                  {(group.schedule?.filter(s => !s.isOneOff) || []).map((item, index) => {
                    const regularSchedules = group.schedule?.filter(s => !s.isOneOff) || [];
                    const oneOffSchedules = group.schedule?.filter(s => s.isOneOff) || [];
                    return (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={item.dayOfWeek}
                        onChange={(e) => {
                          const newRegular = [...regularSchedules];
                          newRegular[index].dayOfWeek = parseInt(e.target.value);
                          handleUpdateGroupSchedule(group.id, [...newRegular, ...oneOffSchedules]);
                        }}
                        className="flex-1 bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                      >
                        <option value={1}>Segunda-feira</option>
                        <option value={2}>Terça-feira</option>
                        <option value={3}>Quarta-feira</option>
                        <option value={4}>Quinta-feira</option>
                        <option value={5}>Sexta-feira</option>
                        <option value={6}>Sábado</option>
                        <option value={0}>Domingo</option>
                      </select>
                      <input
                        type="time"
                        value={item.time}
                        onChange={(e) => {
                          const newRegular = [...regularSchedules];
                          newRegular[index].time = e.target.value;
                          handleUpdateGroupSchedule(group.id, [...newRegular, ...oneOffSchedules]);
                        }}
                        className="w-32 bg-surface border border-outline-variant rounded-lg p-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newRegular = [...regularSchedules];
                          newRegular.splice(index, 1);
                          handleUpdateGroupSchedule(group.id, [...newRegular, ...oneOffSchedules]);
                        }}
                        className="p-2 shrink-0 text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )})}
                  <button
                    type="button"
                    onClick={() => {
                      const oneOffSchedules = group.schedule?.filter(s => s.isOneOff) || [];
                      const regularSchedules = group.schedule?.filter(s => !s.isOneOff) || [];
                      handleUpdateGroupSchedule(group.id, [...regularSchedules, { dayOfWeek: 1, time: '18:00' }, ...oneOffSchedules]);
                    }}
                    className="flex items-center gap-2 text-primary font-bold hover:underline self-start mt-1"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Horário Fixo
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2 mb-4">
                  <h4 className="font-label-lg font-bold text-on-surface uppercase tracking-wider">
                    {group.class_category === 'academia' ? 'Lista de Alunos' : `Alunos na Aula (${groupStudents.length})`}
                  </h4>
                </div>

                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {students.length === 0 ? (
                    <p className="text-sm italic text-on-surface-variant text-center py-2">Nenhum aluno cadastrado no sistema.</p>
                  ) : group.class_category === 'academia' ? (
                    <p className="text-sm text-on-surface-variant text-center py-4 px-2">Aulas de academia não possuem alunos fixos atrelados. A presença é controlada na aba Agenda no momento da aula.</p>
                  ) : (
                    students.map(s => (
                      <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container cursor-pointer transition-colors border border-outline-variant/30 hover:border-outline-variant/60">
                        <input 
                          type="checkbox" 
                          checked={group.studentIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleAddStudentToGroup(group.id, s.id);
                            } else {
                              handleRemoveStudentFromGroup(group.id, s.id);
                            }
                          }}
                          className="w-5 h-5 shrink-0 text-primary focus:ring-primary rounded border-outline-variant"
                        />
                        <div className="w-10 h-10 rounded-full overflow-hidden relative shrink-0 border border-outline-variant/20">
                          <Image src={s.image} alt={s.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="font-bold text-base text-on-surface flex-1 min-w-0 truncate">{s.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-outline-variant/30 flex gap-3 bg-surface-container-lowest sticky bottom-0">
                <button 
                  onClick={() => setDeleteConfirmGroupId(group.id)}
                  className="flex-1 py-3 font-bold text-error bg-error/10 hover:bg-error/20 rounded-full transition-colors border border-error/20"
                >
                  Excluir {groupType}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* --- DELETE GROUP CONFIRM MODAL --- */}
      {deleteConfirmGroupId && (() => {
        const group = groups.find(g => g.id === deleteConfirmGroupId);
        if (!group) return null;
        const groupType = getGroupType(group.studentIds.length, group.class_category);
        
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden p-6 gap-4">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-error" /> Excluir {groupType}
              </h3>
              <p className="font-body-md text-on-surface-variant">Tem certeza que deseja excluir esta aula? Os alunos não serão excluídos, apenas a aula deixará de existir.</p>
              <div className="flex gap-3 mt-2">
                <button disabled={isSaving} onClick={() => setDeleteConfirmGroupId(null)} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button 
                  disabled={isSaving} 
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      const { error } = await supabase.from('groups').delete().eq('id', deleteConfirmGroupId);
                      if (error) throw error;
                      setGroups(prev => prev.filter(g => g.id !== deleteConfirmGroupId));
                      setDeleteConfirmGroupId(null);
                      setViewingGroupId(null);
                    } catch (error) {
                      console.error("Error deleting group:", error);
                      alert("Erro ao excluir grupo.");
                    } finally {
                      setIsSaving(false);
                    }
                  }} 
                  className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-error bg-error hover:bg-error/90 rounded-full transition-colors shadow-md disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin text-on-error" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      <StudentFinanceModal 
        isOpen={!!financeModalStudent}
        onClose={() => setFinanceModalStudent(null)}
        student={financeModalStudent}
        onSuccess={() => {
          fetchSupabaseData();
        }}
      />
      
    </main>
  );
}
