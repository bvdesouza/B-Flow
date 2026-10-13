'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, User, Calendar, Clock, DollarSign } from 'lucide-react';

type Student = {
  id: string;
  name: string;
  plan_id: string | null;
  schedule: any[];
};

type Plan = {
  id: string;
  price: number;
};

type NewOneOffClassModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function NewOneOffClassModal({ isOpen, onClose, onSuccess }: NewOneOffClassModalProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('08:00');
  const [priceStr, setPriceStr] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      const { data: studentsData } = await supabase.from('students').select('*').order('name');
      const { data: plansData } = await supabase.from('plans').select('id, price');
      
      if (mounted) {
        setStudents(studentsData || []);
        setPlans(plansData || []);
        setIsLoading(false);
      }
    };
    if (isOpen) {
      load();
      // Reset form
      setTimeout(() => {
        const today = new Date();
        // Format as YYYY-MM-DD local time
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setDate(`${year}-${month}-${day}`);
        
        setSelectedStudent('');
        setTime('08:00');
        setPriceStr('');
        setIsPaid(false);
      }, 0);
    }
    return () => { mounted = false; };
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !date || !time) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }
    
    setIsSaving(true);
    try {
      const student = students.find(s => s.id === selectedStudent);
      if (!student) throw new Error("Student not found");
      
      // 1. Add schedule item to student (isOneOff: true)
      // Get UTC day of week for the local date string to match logic (new Date(date + 'T00:00:00').getDay())
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      
      const newScheduleItem = {
        dayOfWeek: localDate.getDay(),
        time: time,
        isOneOff: true,
        date: date
      };
      
      const updatedSchedule = [...(student.schedule || []), newScheduleItem];
      
      const { error: updateError } = await supabase
        .from('students')
        .update({ schedule: updatedSchedule })
        .eq('id', selectedStudent);
        
      if (updateError) throw updateError;

      // Calculate price logic
      let additionalValue = 0;
      if (priceStr.trim() !== '') {
        const customPrice = parseFloat(priceStr.replace(',', '.'));
        if (!isNaN(customPrice)) {
          const studentPlan = plans.find(p => p.id === student.plan_id);
          const planPrice = studentPlan ? Number(studentPlan.price) : 0;
          additionalValue = customPrice - planPrice;
        }
      }

      // 2. Create the completed session
      const sessionData = {
        attendees: [selectedStudent],
        paid: isPaid,
        academia_count: 0,
        additional_value: additionalValue,
        class_time: time,
        isOneOff: true
      };

      const { error: sessionError } = await supabase.from('sessions').insert({
        type: 'student',
        reference_id: selectedStudent,
        date: new Date(date + 'T' + time + ':00').toISOString(),
        status: 'completed',
        attendee_ids: sessionData
      });

      if (sessionError) throw sessionError;

      onSuccess();
      onClose();
    } catch (err) {
       console.error("Error creating one-off class:", err);
       alert("Ocorreu um erro ao criar a aula avulsa.");
    } finally {
       setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-outline-variant/30 sticky top-0 bg-surface-container-lowest z-10">
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Nova Aula Avulsa
          </h3>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high">
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-on-surface-variant font-label-md">Carregando dados...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col p-6 gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
                <User className="w-4 h-4" /> Aluno
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary text-on-surface appearance-none font-body-lg"
                required
              >
                <option value="" disabled>Selecione um aluno...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-lg"
                  required
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Horário
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-lg"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Valor Cobrado (Opcional)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="Ex: 50,00"
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-lg"
              />
              <p className="text-xs text-on-surface-variant">Se vazio, usará o valor do plano cadastrado para o aluno.</p>
            </div>
            
            <label className="flex items-center gap-3 p-4 rounded-xl border border-outline-variant/50 cursor-pointer hover:bg-surface-container-low transition-colors mt-2">
              <input 
                type="checkbox" 
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="w-5 h-5 text-primary focus:ring-primary border-outline-variant rounded"
              />
              <span className="font-bold text-on-surface">Aula já foi Paga</span>
            </label>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="py-3 px-6 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="py-3 px-6 flex items-center gap-2 font-label-lg font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-md disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Aula Avulsa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
