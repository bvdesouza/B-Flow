'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, User, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QuickPlanModal, CreatedPlan } from './QuickPlanModal';

export type CreatedStudent = {
  id: string;
  name: string;
  plan_id: string | null;
  plan: string;
  status: 'Pago' | 'Pendente';
  image: string;
  schedule: any[];
};

type QuickStudentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStudent: CreatedStudent) => void;
};

export const defaultImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuCpERVaTcTn2IrdVA8tDjzOI9kVSv-vA86BxHzc4NYBF7q7w0-mMcIoD8-4W1LHS70Qe2B9iWsYRQbQed3cLVErzktITlsocnwyu15TcIjjmbsKExW9J-76fhopWR6wGSTnN8zR4Jmo5vXxYUcPjJhrX_ATjCohnFl3SNxvmC6kCIHI4i_Dmmx7WGV1km1yjG8grpBEar1TdhanldRbP_jlf47LuGTc0w_Qx6xrGk1NfCTY0jRK2VKYpl_CgznGxp369kxexPj0W_EX";

export function QuickStudentModal({ isOpen, onClose, onSuccess }: QuickStudentModalProps) {
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState<string>('');
  const [plans, setPlans] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickPlanModalOpen, setIsQuickPlanModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setTimeout(() => {
        if (isMounted) {
          setName('');
          setErrorMsg('');
        }
      }, 0);

      const loadPlans = async () => {
        try {
          const { data } = await supabase.from('plans').select('*').order('created_at', { ascending: false });
          if (isMounted && data) {
            setPlans(data);
            const defaultPlan = data.find(p => p.is_default) || data[0];
            if (defaultPlan && !planId) {
              setPlanId(defaultPlan.id);
            }
          }
        } catch (err) {
          console.error('Error fetching plans in QuickStudentModal:', err);
        }
      };
      loadPlans();
    }
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do aluno.');
      return;
    }
    setErrorMsg('');
    setIsSaving(true);

    try {
      const selectedPlan = plans.find(p => p.id === planId);
      const studentData = {
        name: name.trim(),
        plan: selectedPlan ? selectedPlan.name : '',
        plan_id: planId || null,
        status: 'Pago', // Default, não incomoda o personal agora
        image: defaultImage,
        schedule: []
      };

      const { data, error } = await supabase.from('students').insert([studentData]).select();
      if (error) throw error;

      if (data && data[0]) {
        onSuccess(data[0] as CreatedStudent);
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar aluno rápido:', err);
      setErrorMsg(err?.message || 'Erro ao cadastrar novo aluno.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-2xl flex flex-col my-auto border border-outline-variant/40 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface rounded-t-3xl shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-4 h-4" />
            </div>
            <h3 className="font-title-lg font-bold text-on-surface">Novo Aluno Rápido</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-highest p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
              Nome do Aluno *
            </label>
            <input 
              required 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface text-sm" 
              placeholder="Ex: João da Silva" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
                Plano do Aluno
              </label>
              <button
                type="button"
                onClick={() => setIsQuickPlanModalOpen(true)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Criar Plano
              </button>
            </div>
            {plans.length === 0 ? (
              <div className="flex flex-col items-start gap-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                <p className="text-xs text-on-surface-variant">Nenhum plano cadastrado.</p>
                <button
                  type="button"
                  onClick={() => setIsQuickPlanModalOpen(true)}
                  className="text-xs py-1.5 px-3 bg-primary text-on-primary rounded-full font-bold shadow-sm"
                >
                  + Criar Plano Agora
                </button>
              </div>
            ) : (
              <select 
                value={planId} 
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    setIsQuickPlanModalOpen(true);
                  } else {
                    setPlanId(e.target.value);
                  }
                }} 
                className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary transition-all text-on-surface text-sm"
              >
                <option value="">Sem plano selecionado</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="new">+ Cadastrar novo plano...</option>
              </select>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-outline-variant/30 mt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="flex-1 py-2.5 flex justify-center items-center gap-2 text-sm font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-on-primary" /> : <Plus className="w-4 h-4" />}
              Cadastrar Aluno
            </button>
          </div>
        </form>
      </div>

      <QuickPlanModal
        isOpen={isQuickPlanModalOpen}
        onClose={() => setIsQuickPlanModalOpen(false)}
        onSuccess={(newPlan: CreatedPlan) => {
          setPlans(prev => [newPlan, ...prev]);
          setPlanId(newPlan.id);
          setIsQuickPlanModalOpen(false);
        }}
      />
    </div>
  );
}
