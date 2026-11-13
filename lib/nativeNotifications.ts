// Notificações nativas das aulas (Android/iOS via Capacitor).
// Os avisos são AGENDADOS no próprio sistema do celular, então aparecem como pop-up
// mesmo com o app fechado. No navegador (AI Studio / site) nada aqui é executado.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';
import { getLocalDateString } from './utils';

export const CLASS_CHANNEL_ID = 'aulas';
export const CLASS_ACTION_TYPE = 'AULA';
export const ACTION_CONFIRM = 'confirmar';
export const ACTION_CANCEL = 'cancelar';

const DAYS_AHEAD = 7;
const MAX_SCHEDULED = 60;

export type ClassNotificationData = {
  kind: 'aula';
  id: string;
  type: 'student' | 'group';
  name: string;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  planName: string;
  isOneOff: boolean;
  studentIds: string[];
};

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const getNotificationSettings = () => {
  if (typeof window === 'undefined') return { enabled: true, offset: 0 };
  const enabled = localStorage.getItem('app_notifications_enabled');
  const offset = localStorage.getItem('app_notifications_offset');
  return {
    enabled: enabled === null ? true : enabled === 'true',
    offset: parseInt(offset || '0', 10) || 0,
  };
};

let setupPromise: Promise<void> | null = null;

// Cria o canal de alta prioridade (pop-up no topo da tela) e os botões da notificação.
export const setupNativeNotifications = (): Promise<void> => {
  if (!isNativeApp()) return Promise.resolve();
  if (!setupPromise) {
    setupPromise = (async () => {
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: CLASS_CHANNEL_ID,
          name: 'Aulas',
          description: 'Avisos para confirmar a presença nas suas aulas',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#10B981',
        });
      }
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: CLASS_ACTION_TYPE,
            actions: [
              { id: ACTION_CONFIRM, title: 'Confirmar presença', foreground: true },
              { id: ACTION_CANCEL, title: 'Cancelar aula', foreground: true, destructive: true },
            ],
          },
        ],
      });
    })().catch((err) => {
      setupPromise = null;
      console.error('Erro ao preparar notificações nativas:', err);
    });
  }
  return setupPromise;
};

export const getPermissionState = async (): Promise<PermissionState> => {
  if (!isNativeApp()) {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const p = Notification.permission;
    return p === 'default' ? 'prompt' : p;
  }
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
};

export const requestPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const p = await Notification.requestPermission();
    return p === 'default' ? 'prompt' : p;
  }
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
};

const notificationIdFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2000000000) + 1;
};

const buildContent = (c: ClassNotificationData, offset: number) => {
  const title = offset > 0
    ? 'A aula de ' + c.name + ' começa em ' + offset + ' min'
    : 'Está na hora da aula de ' + c.name;
  const body = 'Aula das ' + c.time;
  return { title, body };
};

// Lista as aulas dos próximos dias que ainda não foram registradas.
export const getUpcomingClasses = async (daysAhead = DAYS_AHEAD): Promise<ClassNotificationData[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const [{ data: students }, { data: groups }, { data: plans }] = await Promise.all([
    supabase.from('students').select('*'),
    supabase.from('groups').select('*, group_students(student_id)'),
    supabase.from('plans').select('id, name'),
  ]);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  const { data: sessions } = await supabase
    .from('sessions')
    .select('reference_id, type, date, status, attendee_ids')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString());

  const planName = (planId: string | null) => plans?.find((p: any) => p.id === planId)?.name || 'Sem plano';
  const result: ClassNotificationData[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dateStr = getLocalDateString(day);
    const weekday = day.getDay();

    const alreadyRecorded = (refId: string, type: string, time: string, isOneOff: boolean) =>
      (sessions || []).some((s: any) => {
        if (s.reference_id !== refId || s.type !== type) return false;
        if (getLocalDateString(new Date(s.date)) !== dateStr) return false;
        if (s.status !== 'completed' && s.status !== 'rescheduled' && s.status !== 'cancelled') return false;
        const a = s.attendee_ids || {};
        if (!!a.isOneOff !== isOneOff) return false;
        if (isOneOff && typeof a.notes === 'string' && a.notes.includes(time)) return true;
        if (!isOneOff && !a.class_time) return true;
        return a.class_time === time;
      });

    const collect = (owner: any, type: 'student' | 'group', studentIds: string[]) => {
      (owner.schedule || []).forEach((s: any) => {
        if (!s?.time) return;
        const isOneOff = !!s.isOneOff;
        const matches = isOneOff ? s.date === dateStr : s.dayOfWeek === weekday;
        if (!matches) return;
        if (alreadyRecorded(owner.id, type, s.time, isOneOff)) return;
        result.push({
          kind: 'aula',
          id: owner.id,
          type,
          name: owner.name,
          time: s.time,
          date: dateStr,
          planName: planName(owner.plan_id),
          isOneOff,
          studentIds,
        });
      });
    };

    (students || []).forEach((st: any) => collect(st, 'student', [st.id]));
    (groups || []).forEach((g: any) =>
      collect(g, 'group', (g.group_students || []).map((gs: any) => gs.student_id)),
    );
  }

  return result;
};

const triggerDate = (c: ClassNotificationData, offset: number) => {
  const [y, m, d] = c.date.split('-').map(Number);
  const [hh, mm] = c.time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm - offset, 0, 0);
};

// Cancela os avisos antigos e agenda os dos próximos dias. Retorna quantos foram agendados.
export const rescheduleClassNotifications = async (): Promise<number> => {
  if (!isNativeApp()) return 0;
  await setupNativeNotifications();

  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n: any) => n.extra?.kind === 'aula');
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }

  const { enabled, offset } = getNotificationSettings();
  if (!enabled) return 0;
  if ((await getPermissionState()) !== 'granted') return 0;

  const now = Date.now() + 30 * 1000;
  const items = (await getUpcomingClasses())
    .map((c) => ({ c, at: triggerDate(c, offset) }))
    .filter(({ at }) => at.getTime() > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  if (items.length === 0) return 0;

  await LocalNotifications.schedule({
    notifications: items.map(({ c, at }) => {
      const { title, body } = buildContent(c, offset);
      return {
        id: notificationIdFor(c.id + '_' + c.date + '_' + c.time),
        title,
        body,
        largeBody: body,
        channelId: CLASS_CHANNEL_ID,
        actionTypeId: CLASS_ACTION_TYPE,
        smallIcon: 'ic_stat_bflow',
        iconColor: '#10B981',
        autoCancel: true,
        schedule: { at, allowWhileIdle: true },
        extra: c,
      };
    }),
  });

  return items.length;
};

// Chamado quando o usuário toca na notificação ou em um dos botões (mesmo que o app estivesse fechado).
export const onClassNotificationAction = (
  cb: (actionId: string, data: ClassNotificationData) => void,
): (() => void) => {
  if (!isNativeApp()) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const data = event.notification?.extra as ClassNotificationData | undefined;
    if (data && data.kind === 'aula') cb(event.actionId, data);
  });
  return () => {
    handle.then((h) => h.remove()).catch(() => {});
  };
};

// ---- Ações da notificação (Confirmar presença / Cancelar aula) ----
// Grava direto no banco. Funciona mesmo quando o app foi aberto pelo botão da notificação:
// espera a sessão do login ser restaurada antes de salvar.
const classDayBounds = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
};

const sameClass = (s: any, c: ClassNotificationData) => {
  const a = s.attendee_ids && !Array.isArray(s.attendee_ids) ? s.attendee_ids : {};
  if (a.class_time) {
    if (a.class_time !== c.time) return false;
    if (a.isOneOff !== undefined) return !!a.isOneOff === !!c.isOneOff;
    return !c.isOneOff;
  }
  if (c.isOneOff) return typeof a.notes === 'string' && a.notes.includes(c.time);
  return !a.isOneOff;
};

export type ClassActionResult = { ok: boolean; message: string };

export const performClassAction = async (
  action: 'confirm' | 'cancel',
  c: ClassNotificationData,
): Promise<ClassActionResult> => {
  // Aguarda o login ser restaurado (o app pode ter acabado de abrir pela notificação)
  let session = null;
  for (let i = 0; i < 20 && !session; i++) {
    const res = await supabase.auth.getSession();
    session = res.data.session;
    if (!session) await new Promise((r) => setTimeout(r, 500));
  }
  if (!session) return { ok: false, message: 'Entre na sua conta para registrar a aula.' };

  const { start, end } = classDayBounds(c.date);
  const { data: existing, error: fetchError } = await supabase
    .from('sessions')
    .select('id, attendee_ids, status')
    .eq('reference_id', c.id)
    .eq('type', c.type)
    .gte('date', start.toISOString())
    .lte('date', end.toISOString());
  if (fetchError) return { ok: false, message: 'Não foi possível salvar. Tente pela agenda.' };

  const current = (existing || []).find((s: any) => sameClass(s, c));
  const prev = current && current.attendee_ids && !Array.isArray(current.attendee_ids) ? current.attendee_ids : {};

  const [hh, mm] = c.time.split(':').map(Number);
  const classDate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hh || 0, mm || 0);

  let status: string;
  let attendee_ids: any;
  if (action === 'confirm') {
    status = 'completed';
    attendee_ids = {
      external_visitors: [],
      paid: false,
      academia_count: 0,
      additional_value: 0,
      ...prev,
      attendees: c.studentIds || [],
      class_time: c.time,
      isOneOff: !!c.isOneOff,
    };
  } else {
    status = 'cancelled';
    attendee_ids = { ...prev, class_time: c.time, isOneOff: !!c.isOneOff };
  }

  const { error } = current
    ? await supabase.from('sessions').update({ status, attendee_ids }).eq('id', current.id)
    : await supabase.from('sessions').insert({
        type: c.type,
        reference_id: c.id,
        date: classDate.toISOString(),
        status,
        attendee_ids,
      });
  if (error) return { ok: false, message: 'Não foi possível salvar. Tente pela agenda.' };

  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('agenda-updated'));
  return {
    ok: true,
    message: action === 'confirm'
      ? 'Presença confirmada: aula de ' + c.name + ' (' + c.time + ')'
      : 'Aula de ' + c.name + ' (' + c.time + ') cancelada',
  };
};
