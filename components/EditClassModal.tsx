"use client";
import { useState, useEffect } from 'react';
import { X, Loader2, CalendarClock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';

type EditClassModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agendaItem: any | null;
  dayOfWeek: number;
  currentDate?: Date;
  onSuccess: () => void;
};

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function EditClassModal({ isOpen, onClose, agendaItem, dayOfWeek, currentDate = new Date(), onSuccess }: EditClassModalProps) {
  const [time, setTime] = useState('');
  const [newDayOfWeek, setNewDayOfWeek] = useState<number>(dayOfWeek);
  const [specificDate, setSpecificDate] = useState('');
  const [changeType, setChangeType] = useState<'fixed' | 'punctual'>('fixed');
  const [isSaving, setIsSaving] = useState(false);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!isOpen || !agendaItem) return;
      try {
        const table = agendaItem.type === 'group' ? 'groups' : 'students';
        const { data } = await supabase
          .from(table)
          .select('schedule')
          .eq('id', agendaItem.id)
          .single();
        if (data) {
          setSchedule(data.schedule || []);
        }
      } catch (err) {
        console.error('Error fetching schedule:', err);
      }
    };

    fetchSchedule();
  }, [isOpen, agendaItem]);

  useEffect(() => {
    if (isOpen && agendaItem) {
      setTimeout(() => {
        setTime(agendaItem.time);
        setNewDayOfWeek(dayOfWeek);
        setChangeType('fixed');
        
        const dateStr = getLocalDateString(currentDate);
        setSpecificDate(dateStr);
      }, 0);
    }
  }, [isOpen, agendaItem, dayOfWeek, currentDate]);

  const isDuplicate = (() => {
    if (!time || !schedule.length || !agendaItem) {
      return false;
    }

    if (changeType === 'fixed') {
      return schedule.some((s: any) => 
        !s.isOneOff && 
        s.dayOfWeek === newDayOfWeek && 
        s.time === time &&
        !(s.dayOfWeek === dayOfWeek && s.time === agendaItem.time)
      );
    } else {
      if (!specificDate) {
        return false;
      }
      
      const parts = specificDate.split('-');
      const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
      const targetDayOfWeek = targetDate.getDay();

      return schedule.some((s: any) => {
        if (s.isOneOff) {
          return s.date === specificDate && s.time === time;
        } else {
          return s.dayOfWeek === targetDayOfWeek && s.time === time;
        }
      });
    }
  })();

  if (!isOpen || !agendaItem) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const table = agendaItem.type === 'group' ? 'groups' : 'students';
      
      // Fetch current schedule
      const { data, error: fetchError } = await supabase
        .from(table)
        .select('schedule')
        .eq('id', agendaItem.id)
        .single();
        
      if (fetchError) throw fetchError;
      
      let schedule = data.schedule || [];
      
      if (changeType === 'fixed') {
        // Update the specific time for the matched day of week and old time
        let found = false;
        schedule = schedule.map((s: any) => {
          if (s.dayOfWeek === dayOfWeek && s.time === agendaItem.time && !found && !s.isOneOff) {
            found = true;
            return { ...s, time, dayOfWeek: newDayOfWeek };
          }
          return s;
        });
        
        const { error: updateError } = await supabase
          .from(table)
          .update({ schedule })
          .eq('id', agendaItem.id);
          
        if (updateError) throw updateError;

      } else {
        // Punctual change:
        // 1. Mark original class as rescheduled (cancelled/rescheduled on original date)
        const oldDate = currentDate.toISOString();
        const { error: sessionError } = await supabase.from('sessions').insert({
          type: agendaItem.type,
          reference_id: agendaItem.id,
          date: oldDate,
          status: 'rescheduled',
          attendee_ids: { 
            notes: `Reagendado para ${specificDate} às ${time}`,
            rescheduledToDate: specificDate,
            rescheduledToTime: time,
            class_time: agendaItem.time
          }
        });
        
        if (sessionError) throw sessionError;

        // 2. Add one-off schedule
        schedule.push({
          time,
          date: specificDate,
          isOneOff: true
        });

        const { error: updateError } = await supabase
          .from(table)
          .update({ schedule })
          .eq('id', agendaItem.id);
          
        if (updateError) throw updateError;
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar o horário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePermanently = async () => {
    if (!agendaItem || !agendaItem.scheduleItem) return;
    
    const isOneOff = agendaItem.scheduleItem?.isOneOff;
    setIsSaving(true);
    try {
      const table = agendaItem.type === 'group' ? 'groups' : 'students';
      
      let updatedSchedule = schedule || [];
      
      if (isOneOff) {
        updatedSchedule = updatedSchedule.filter((s: any) => !(
          s.isOneOff && 
          s.date === agendaItem.scheduleItem.date && 
          s.time === agendaItem.time
        ));
      } else {
        const itemDayOfWeek = agendaItem.scheduleItem.dayOfWeek;
        updatedSchedule = updatedSchedule.filter((s: any) => !(
          !s.isOneOff && 
          s.dayOfWeek === itemDayOfWeek && 
          s.time === agendaItem.time
        ));
      }
      
      const { error: updateError } = await supabase
        .from(table)
        .update({ schedule: updatedSchedule })
        .eq('id', agendaItem.id);
        
      if (updateError) throw updateError;
      
      if (agendaItem.session?.id) {
        await supabase
          .from('sessions')
          .delete()
          .eq('id', agendaItem.session.id);
      } else {
        const dateStr = getLocalDateString(currentDate);
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
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir a aula.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-outline-variant/30 shrink-0">
          <h3 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" />
            Reagendar Aula
          </h3>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col p-6 gap-6 overflow-y-auto">
          <div className="flex flex-col gap-1.5 bg-surface-container-low p-4 rounded-xl">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Aula Atual</label>
            <p className="font-title-md text-on-surface font-bold">{agendaItem.name}</p>
            <p className="text-sm text-on-surface-variant">{DAYS[dayOfWeek]} às {agendaItem.time}</p>
          </div>
          
          <div className="flex flex-col gap-3">
            <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Tipo de Reagendamento</label>
            <div className="flex flex-col gap-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${changeType === 'punctual' ? 'bg-primary-container/20 border-primary shadow-sm' : 'bg-surface border-outline-variant/50 hover:bg-surface-container-low'}`}>
                <input type="radio" name="changeType" checked={changeType === 'punctual'} onChange={() => setChangeType('punctual')} className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Mudança Pontual</span>
                  <span className="text-xs text-on-surface-variant">Apenas para esta semana</span>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${changeType === 'fixed' ? 'bg-primary-container/20 border-primary shadow-sm' : 'bg-surface border-outline-variant/50 hover:bg-surface-container-low'}`}>
                <input type="radio" name="changeType" checked={changeType === 'fixed'} onChange={() => setChangeType('fixed')} className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Mudança Fixa</span>
                  <span className="text-xs text-on-surface-variant">Alterar horário padrão na agenda</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Novo Horário</label>
              <input 
                required
                type="time" 
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
              />
            </div>

            {changeType === 'fixed' ? (
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Novo Dia da Semana</label>
                <select 
                  value={newDayOfWeek}
                  onChange={(e) => setNewDayOfWeek(parseInt(e.target.value))}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                >
                  {DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Data Específica</label>
                <input 
                  required
                  type="date" 
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                />
              </div>
            )}
          </div>

          {isDuplicate && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl p-4 flex gap-3 items-start text-xs transition-all animate-pulse">
              <span className="text-base">⚠️</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">Aviso de Duplicidade</span>
                <span>Este aluno/grupo já possui uma aula agendada para este dia e horário! Se prosseguir, criará uma duplicidade.</span>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 w-full">
            <div className="flex gap-3 w-full">
              <button type="button" onClick={onClose} className="flex-1 py-3 font-label-lg font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-full transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className="flex-1 py-3 flex justify-center items-center gap-2 font-label-lg font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors shadow-md disabled:opacity-50">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
              </button>
            </div>
            {!showDeleteConfirm ? (
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="w-full flex justify-center items-center gap-2 text-error/80 font-label-md hover:text-error hover:underline transition-all mt-4"
              >
                <Trash2 className="w-4 h-4" /> Excluir permanentemente da agenda
              </button>
            ) : (
              <div className="mt-2 flex flex-col gap-2 p-3 bg-error-container/20 border border-error-container rounded-xl">
                <span className="text-sm font-medium text-error text-center">
                  Tem certeza que deseja apagar permanentemente?
                </span>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowDeleteConfirm(false)} 
                    className="flex-1 py-2 font-label-md font-bold text-on-surface bg-surface-container rounded-full"
                  >
                    Não
                  </button>
                  <button 
                    type="button" 
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
        </form>
      </div>
    </div>
  );
}
