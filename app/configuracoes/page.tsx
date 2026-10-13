'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Loader2, Save, User as UserIcon, Bell, Play, Check } from 'lucide-react';
import Image from 'next/image';

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [formData, setFormData] = useState({
    full_name: '',
    preferred_name: '',
    phone: '',
    avatar_url: '',
    new_password: '',
    confirm_password: ''
  });

  const [notifEnabled, setNotifEnabled] = useState<boolean>(true);
  const [notifOffset, setNotifOffset] = useState<number>(0);
  const [notifPlatform, setNotifPlatform] = useState<'auto' | 'android' | 'ios'>('auto');
  const [notifSavedSuccess, setNotifSavedSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('app_notifications_enabled');
      if (savedEnabled !== null) setNotifEnabled(savedEnabled === 'true');
      const savedOffset = localStorage.getItem('app_notifications_offset');
      if (savedOffset !== null) setNotifOffset(parseInt(savedOffset, 10) || 0);
      const savedPlatform = localStorage.getItem('app_notifications_platform');
      if (savedPlatform) setNotifPlatform(savedPlatform as any);
    }

    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setFormData({
            full_name: user.user_metadata?.full_name || '',
            preferred_name: user.user_metadata?.preferred_name || '',
            phone: user.user_metadata?.phone || '',
            avatar_url: user.user_metadata?.avatar_url || '',
            new_password: '',
            confirm_password: ''
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });

    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setMessage({ text: 'As senhas não coincidem.', type: 'error' });
      setSaving(false);
      return;
    }

    try {
      const updates: any = {
        data: {
          full_name: formData.full_name,
          preferred_name: formData.preferred_name,
          phone: formData.phone,
          avatar_url: formData.avatar_url
        }
      };

      if (formData.new_password) {
        updates.password = formData.new_password;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;
      setMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' });
      setFormData(prev => ({ ...prev, new_password: '', confirm_password: '' }));
    } catch (error: any) {
      setMessage({ text: error.message || 'Erro ao atualizar perfil.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage({ text: '', type: '' });

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você deve selecionar uma imagem para fazer upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: data.publicUrl });
      
      // Auto save after upload
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...formData,
          avatar_url: data.publicUrl
        }
      });
      if (updateError) throw updateError;
      
      setMessage({ text: 'Foto de perfil atualizada!', type: 'success' });
    } catch (error: any) {
      setMessage({ text: error.message || 'Erro ao fazer upload da imagem.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveNotifications = (enabledVal: boolean, offsetVal: number, platformVal: 'auto' | 'android' | 'ios') => {
    localStorage.setItem('app_notifications_enabled', String(enabledVal));
    localStorage.setItem('app_notifications_offset', String(offsetVal));
    localStorage.setItem('app_notifications_platform', platformVal);
    
    // Dispatch instant settings update event
    window.dispatchEvent(new CustomEvent('notification-settings-updated', {
      detail: { enabled: enabledVal, offset: offsetVal, platform: platformVal }
    }));

    setNotifSavedSuccess(true);
    setTimeout(() => setNotifSavedSuccess(false), 3000);
  };

  const handleTriggerSimulation = () => {
    // Generate a simulated notification detail with current time
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const detail = {
      id: 'simulation-id',
      type: 'group',
      name: 'Simulação de Aula (Pilates)',
      time: nowStr,
      planName: 'Plano Semanal Fixo',
      scheduleItem: { isOneOff: false },
      originalData: {},
      studentIds: []
    };

    window.dispatchEvent(new CustomEvent('simulate-notification', { detail }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="w-full max-w-3xl mx-auto px-margin-mobile pt-[80px] pb-[180px] md:pb-stack-lg md:pt-stack-lg md:pr-margin-tablet">
      <section className="mb-stack-lg">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Configurações</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-1">Gerencie seu perfil de professor</p>
        </div>
      </section>

      <section className="bg-surface-container-low rounded-[24px] p-6 shadow-sm border border-outline-variant/50">
        {message.text && (
          <div className={`p-4 rounded-xl mb-6 font-bold text-sm ${message.type === 'success' ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col items-center sm:items-start gap-4 sm:flex-row sm:gap-6 pb-6 border-b border-outline-variant/30">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-surface-container bg-surface-container flex items-center justify-center">
              {formData.avatar_url ? (
                <Image src={formData.avatar_url} alt="Profile" fill className="object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-12 h-12 text-on-surface-variant" />
              )}
              
              <label 
                htmlFor="avatar-upload" 
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
              </label>
              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                onChange={uploadAvatar} 
                disabled={uploading}
                className="hidden" 
              />
            </div>
            
            <div className="flex flex-col justify-center text-center sm:text-left">
              <h3 className="font-title-lg text-on-surface font-bold">Foto de Perfil</h3>
              <p className="font-body-sm text-on-surface-variant mt-1 max-w-[250px]">
                Clique na imagem para enviar uma nova foto. Recomendamos uma imagem quadrada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">Nome Completo</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="Seu nome completo"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">Como gostaria de ser chamado?</label>
              <input
                type="text"
                name="preferred_name"
                value={formData.preferred_name}
                onChange={handleChange}
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="Seu apelido ou nome profissional"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">Número de Telefone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          
          <div className="pt-4 border-t border-outline-variant/30">
            <h3 className="font-title-md text-on-surface font-bold mb-4">Segurança</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">Nova Senha (opcional)</label>
                <input
                  type="password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-outline-variant/30">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 py-3 px-6 bg-primary text-on-primary font-bold font-label-lg rounded-full hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </section>

      {/* Seção de Notificações */}
      <section className="bg-surface-container-low rounded-[24px] p-6 shadow-sm border border-outline-variant/50 mt-6">
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            <h3 className="font-title-lg text-on-surface font-bold">Notificações das Aulas</h3>
          </div>
          <p className="font-body-md text-on-surface-variant">Configure e teste os alertas de aula e confirmação rápida no Android e iPhone</p>
        </div>

        {notifSavedSuccess && (
          <div className="p-4 rounded-xl mb-6 font-bold text-sm bg-primary-container text-on-primary-container flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            Preferências de notificação salvas com sucesso!
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-on-surface">Ativar Notificações de Aula</span>
              <span className="text-xs text-on-surface-variant">Mostrar alertas popup na hora ou minutos antes da aula iniciar</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextVal = !notifEnabled;
                setNotifEnabled(nextVal);
                handleSaveNotifications(nextVal, notifOffset, notifPlatform);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notifEnabled ? 'bg-primary' : 'bg-outline-variant'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                  notifEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Platform / Style Selection */}
          {notifEnabled && (
            <div className="flex flex-col gap-2 pb-4 border-b border-outline-variant/30">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">
                Estilo Visual do Alerta
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Auto (Detectar)', value: 'auto' },
                  { label: 'Android', value: 'android' },
                  { label: 'iPhone (iOS)', value: 'ios' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setNotifPlatform(opt.value as any);
                      handleSaveNotifications(notifEnabled, notifOffset, opt.value as any);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                      notifPlatform === opt.value
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-surface border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Offset Selection */}
          {notifEnabled && (
            <div className="flex flex-col gap-2 pb-4 border-b border-outline-variant/30">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold ml-1">
                Quando disparar o alerta?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'No horário', value: 0 },
                  { label: '5 min antes', value: 5 },
                  { label: '10 min antes', value: 10 },
                  { label: '15 min antes', value: 15 },
                  { label: '30 min antes', value: 30 },
                  { label: '1 hora antes', value: 60 }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setNotifOffset(opt.value);
                      handleSaveNotifications(notifEnabled, opt.value, notifPlatform);
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all text-center ${
                      notifOffset === opt.value
                        ? 'bg-primary/15 border-primary text-primary'
                        : 'bg-surface border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Simulation Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-on-surface">Simular Notificação Agora</span>
              <span className="text-xs text-on-surface-variant">Teste a aparência e o recurso de confirmação rápida instantaneamente</span>
            </div>
            <button
              type="button"
              onClick={handleTriggerSimulation}
              className="flex items-center justify-center gap-1.5 py-2.5 px-5 bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-bold text-xs rounded-xl border border-outline-variant transition-all shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              Testar Notificação
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
