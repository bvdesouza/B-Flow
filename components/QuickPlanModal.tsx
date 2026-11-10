'use client';

import { useState } from 'react';
import { X, Loader2, Plus, Dumbbell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type CreatedPlan = {
  id: string;
  name: string;
  type: string;
  price: number;
  billing_cycle: string;
  description: string;
  is_default: boolean;
};

type QuickPlanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPlan: CreatedPlan) => void;
};

export function QuickPlanModal({ isOpen, onClose, onSuccess }: QuickPlanModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Pagamento por pacote');
  const [billingCycle, setBillingCycle] = useState('pacote');
  const [priceStr, setPriceStr] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do plano.');
      return;
    }
    setErrorMsg('');
    setIsSaving(true);

    try {
      if (isDefault) {
        await supabase.from('plans').update({ is_default: false }).eq('is_default', true);
      }

      const parsedPrice = priceStr ? parseFloat(priceStr.replace(',', '.')) : 0;
      const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;

      const newPlanData = {
        name: name.trim(),
        type,
        price: finalPrice,
        billing_cycle: billingCycle,
        description: description.trim(),
        is_default: isDefault
      };

      const { data, error } = await supabase.from('plans').insert([newPlanData]).select();
      if (error) throw error;

      if (data && data[0]) {
        // Reset state
        setName('');
        setType('Pagamento por pacote');
        setBillingCycle('pacote');
        setPriceStr('');
        setDescription('');
        setIsDefault(false);
        onSuccess(data[0] as CreatedPlan);
      }
    } catch (err: any) {
      console.error('Erro ao criar plano rápido:', err);
      setErrorMsg(err?.message || 'Erro ao salvar novo plano.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-container w-full max-w-md rounded-3xl shadow-2xl flex flex-col my-auto border border-outline-variant/40 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface rounded-t-3xl shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h3 className="font-title-lg font-bold text-on-surface">Criar Novo Plano</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-highest p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
              Nome do Plano *
            </label>
            <input 
              required 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface text-sm" 
              placeholder="Ex: Mensal 2x por semana" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
              Tipo de Cobrança
            </label>
            <select 
              value={type} 
              onChange={(e) => {
                const val = e.target.value;
                let cycle = 'pacote';
                if (val === 'Pagamento por aula') cycle = 'aula';
                if (val === 'Pagamento Mensal Fixo') cycle = 'mês';
                if (val === 'Condição especial') cycle = 'especial';
                setType(val);
                setBillingCycle(cycle);
              }} 
              className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary transition-all text-on-surface text-sm"
            >
              <option value="Pagamento Mensal Fixo">Pagamento Mensal Fixo (por mês)</option>
              <option value="Pagamento por aula">Pagamento por aula (avulso)</option>
              <option value="Pagamento por pacote">Pagamento por pacote (conjunto de aulas)</option>
              <option value="Condição especial">Condição especial</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
              Preço (R$)
            </label>
            <input 
              type="text" 
              inputMode="decimal" 
              value={priceStr} 
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                setPriceStr(val);
              }} 
              className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface text-sm" 
              placeholder="Ex: 250,00" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-on-surface font-bold ml-1 uppercase tracking-wider text-xs">
              Descrição (opcional)
            </label>
            <textarea 
              rows={2} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full bg-surface py-2.5 px-3.5 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface text-sm resize-none" 
              placeholder="Observações do plano..." 
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input 
              type="checkbox" 
              checked={isDefault} 
              onChange={(e) => setIsDefault(e.target.checked)} 
              className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant"
            />
            <span className="text-xs font-bold text-on-surface">Definir como plano padrão</span>
          </label>

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
              Criar e Selecionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
