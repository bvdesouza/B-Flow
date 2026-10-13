'use client';

import { useState, useEffect } from 'react';
import { Star, Pencil, Plus, Clock, X, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFinance } from '@/components/FinanceContext';

type Plan = {
  id: string;
  name: string;
  type: string;
  price: number;
  billing_cycle: string;
  description: string;
  is_default: boolean;
};

export default function Planos() {
  const { formatCurrency } = useFinance();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Omit<Plan, 'price'>> & { price?: number | string }>({
    name: '', type: 'Pagamento por pacote', price: 0, billing_cycle: 'pacote', description: '', is_default: false
  });
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase.from('plans').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPlans(data || []);
    } catch (err: any) {
      console.log("Supabase fetch error:", err);
      setFetchError("Não foi possível conectar ao banco de dados Supabase.");
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) fetchPlans();
    else setIsLoaded(true);
  }, []);

  const handleOpenModal = (plan?: Plan) => {
    if (plan) {
      setEditingId(plan.id);
      setFormData(plan);
    } else {
      setEditingId(null);
      setFormData({ name: '', type: 'Pagamento por pacote', price: 0, billing_cycle: 'pacote', description: '', is_default: false });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (formData.is_default) {
        // Unset any existing default plan if this one is set to default
        await supabase.from('plans').update({ is_default: false }).eq('is_default', true);
      }

      const parsedPrice = typeof formData.price === 'string' ? parseFloat(formData.price.replace(',', '.')) : formData.price;
      const finalPrice = isNaN(parsedPrice as number) ? 0 : parsedPrice;
      const dataToSave = { ...formData, price: finalPrice };

      if (editingId) {
        const { error } = await supabase.from('plans').update(dataToSave).eq('id', editingId);
        if (error) throw error;
        setPlans(prev => prev.map(p => {
          if (p.id === editingId) return { ...p, ...dataToSave } as Plan;
          if (formData.is_default) return { ...p, is_default: false } as Plan;
          return p;
        }));
      } else {
        const { data, error } = await supabase.from('plans').insert([dataToSave]).select();
        if (error) throw error;
        if (data && data[0]) {
          setPlans(prev => [data[0], ...prev.map(p => formData.is_default ? { ...p, is_default: false } : p)]);
        }
      }
      handleCloseModal();
    } catch (err: any) {
      console.error("Error saving plan:", err);
      alert(`Erro ao salvar plano: ${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsSaving(true);
    try {
      if (deleteConfirmId !== 'default') {
        const { error } = await supabase.from('plans').delete().eq('id', deleteConfirmId);
        if (error) throw error;
        setPlans(prev => prev.filter(p => p.id !== deleteConfirmId));
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error deleting plan:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <main className="w-full max-w-4xl mx-auto px-margin-mobile pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface mb-stack-sm">Meus Planos</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant flex-wrap break-words">Gerencie pacotes e contratos oferecidos aos alunos.</p>
      </div>

      {fetchError && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl mb-4 font-bold text-sm">
          {fetchError}
        </div>
      )}

      <section className="w-full">
        {plans.length === 0 ? (
           <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/50 text-center text-on-surface-variant flex flex-col items-center col-span-full">
             <Star className="w-10 h-10 mb-3 opacity-50" />
             <p className="font-bold mb-4">Nenhum plano cadastrado.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-surface-bright rounded-xl p-4 border border-outline-variant hover:shadow-md transition-shadow relative group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap gap-2 items-center mb-1">
                    <span className={`font-label-sm text-label-sm px-2 py-1 rounded-md font-bold truncate ${
                      plan.type === 'Pagamento Mensal Fixo' ? 'bg-tertiary-container text-on-tertiary-container' : 
                      plan.type === 'Condição especial' ? 'bg-secondary-container text-on-secondary-container' : 
                      plan.type === 'Pagamento por aula' ? 'bg-primary-container text-on-primary-container' :
                      'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {plan.type}
                    </span>
                    {plan.is_default && (
                      <span className="bg-tertiary text-on-tertiary font-label-sm text-label-sm px-2 py-1 rounded-md font-bold shadow-sm">PADRÃO</span>
                    )}
                  </div>
                  <h4 className="font-title-lg text-title-lg text-on-surface mb-0.5 font-bold truncate">{plan.name}</h4>
                  <p className="font-body-md text-body-md text-on-surface-variant line-clamp-1">{plan.description}</p>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-outline-variant/30 pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <div className="flex sm:flex-col items-baseline sm:items-end gap-1 sm:gap-0">
                    <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface truncate">{formatCurrency(plan.price)}</span>
                    <span className="font-body-md text-body-md text-outline font-bold truncate">/ {plan.billing_cycle}</span>
                  </div>
                  <div className="flex gap-1 relative z-10">
                    <button onClick={() => handleOpenModal(plan)} aria-label="Edit Plan" className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-colors">
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => setDeleteConfirmId(plan.id)} aria-label="Delete Plan" className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-full transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <button onClick={() => handleOpenModal()} aria-label="Adicionar Plano" className="fixed bottom-[100px] right-margin-mobile md:bottom-margin-tablet md:right-margin-tablet w-14 h-14 bg-primary text-on-primary rounded-xl shadow-lg flex items-center justify-center hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors z-50 group">
        <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
      </button>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-container w-full max-w-lg rounded-3xl shadow-xl flex flex-col my-auto max-h-[90vh]">
            <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center bg-surface sticky top-0 rounded-t-3xl z-10 flex-shrink-0">
              <h2 className="font-title-lg font-bold text-on-surface truncate pr-4">
                {editingId ? 'Editar Plano' : 'Novo Plano'}
              </h2>
              <button type="button" onClick={handleCloseModal} className="text-on-surface-variant hover:bg-surface-container-highest p-2 rounded-full transition-colors flex-shrink-0">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto min-h-0">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Nome do Plano</label>
                <input required type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" placeholder="Ex: Pacote 10 Aulas" />
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Tipo de cobrança</label>
                <select 
                  value={formData.type || 'Pagamento por pacote'} 
                  onChange={(e) => {
                    const type = e.target.value;
                    let billing_cycle = 'pacote';
                    if (type === 'Pagamento por aula') billing_cycle = 'aula';
                    if (type === 'Pagamento Mensal Fixo') billing_cycle = 'mês';
                    if (type === 'Condição especial') billing_cycle = 'especial';
                    setFormData({...formData, type, billing_cycle});
                  }} 
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary transition-all text-on-surface appearance-none"
                >
                  <option value="Pagamento por pacote">Pagamento por pacote</option>
                  <option value="Pagamento por aula">Pagamento por aula</option>
                  <option value="Pagamento Mensal Fixo">Pagamento Mensal Fixo</option>
                  <option value="Condição especial">Condição especial</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Preço (R$)</label>
                <input 
                  required 
                  type="text" 
                  inputMode="decimal" 
                  value={formData.price === 0 ? '' : formData.price || ''} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setFormData({...formData, price: val});
                  }} 
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value.replace(',', '.'));
                    setFormData({...formData, price: isNaN(val) ? 0 : val});
                  }}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Descrição</label>
                <textarea rows={3} value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface resize-none" placeholder="Ex: Válido por 30 dias..." />
              </div>

              <div className="flex items-center gap-3">
                <label className="relative flex cursor-pointer items-center rounded-full p-3" htmlFor="is_default">
                  <input
                    type="checkbox"
                    className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-outline-variant transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-primary-container before:opacity-0 before:transition-opacity checked:border-primary checked:bg-primary checked:before:bg-primary hover:before:opacity-10"
                    id="is_default"
                    checked={formData.is_default || false}
                    onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </div>
                </label>
                <label className="font-label-md text-on-surface cursor-pointer select-none font-bold" htmlFor="is_default">
                  Tornar este o plano padrão
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-outline-variant/30 mt-2 sticky bottom-0 bg-surface-container py-2 flex-shrink-0">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface hover:bg-surface-container-high border border-outline-variant rounded-full transition-colors truncate px-2">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-md disabled:opacity-50 truncate px-2">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-on-primary" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container w-full max-w-sm rounded-3xl shadow-xl flex flex-col p-6 animate-zoomIn">
            <h3 className="font-title-lg font-bold text-on-surface mb-2 flex items-center gap-2">
              <Trash2 className="text-error w-6 h-6 flex-shrink-0" />
              Excluir Plano?
            </h3>
            <p className="font-body-md text-on-surface-variant break-words">Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 mt-6">
              <button disabled={isSaving} onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface hover:bg-surface-container-high rounded-full transition-colors border border-outline-variant disabled:opacity-50 truncate px-2">
                Cancelar
              </button>
              <button disabled={isSaving} onClick={handleDelete} className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-error bg-error/10 hover:bg-error/20 border border-error/50 rounded-full transition-colors shadow-sm disabled:opacity-50 truncate px-2">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

