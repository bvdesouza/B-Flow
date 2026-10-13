'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, Info, Play, Settings, RefreshCcw } from 'lucide-react';

type NotificationItem = {
  id: string;
  type: 'student' | 'group';
  name: string;
  time: string;
  planName: string;
  scheduleItem: any;
  originalData: any;
  studentIds?: string[];
};

export function AndroidNotificationManager() {
  const [isMounted, setIsMounted] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);
  const [platform, setPlatform] = useState<'auto' | 'android' | 'ios'>('auto');
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);
  const [notifiedKeys, setNotifiedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('app_notifications_enabled');
      if (savedEnabled !== null) setEnabled(savedEnabled === 'true');
      const savedOffset = localStorage.getItem('app_notifications_offset');
      if (savedOffset !== null) setOffsetMinutes(parseInt(savedOffset, 10) || 0);
      const savedPlatform = localStorage.getItem('app_notifications_platform');
      if (savedPlatform) setPlatform(savedPlatform as any);
      const savedNotified = localStorage.getItem('app_notified_classes_today');
      if (savedNotified) {
        try {
          const parsed = JSON.parse(savedNotified);
          const todayStr = getLocalDateString(new Date());
          const todayKeys = parsed.filter((key: string) => key.endsWith(todayStr));
          setNotifiedKeys(new Set(todayKeys));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const [isConfirming, setIsConfirming] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<NotificationItem[]>([]);

  // Resolve active style platform based on preference or user agent computed in render (SSR safe)
  const isIOSDevice = typeof window !== 'undefined' && /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  const resolvedPlatform = platform === 'auto' ? (isIOSDevice ? 'ios' : 'android') : platform;

  // Ref to hold the current values of states to use in interval callback without stale state closure
  const stateRef = useRef({ enabled, offsetMinutes, notifiedKeys, activeNotification });

  useEffect(() => {
    stateRef.current = { enabled, offsetMinutes, notifiedKeys, activeNotification };
  }, [enabled, offsetMinutes, notifiedKeys, activeNotification]);

  // Sync notified keys to localStorage
  const addNotifiedKey = useCallback((key: string) => {
    setNotifiedKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem('app_notified_classes_today', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // Core function to check and find any matching class to notify
  const checkUpcomingClasses = useCallback(async () => {
    const currentSettings = stateRef.current;
    if (!currentSettings.enabled) return;

    try {
      const { data: { session: userSession } } = await supabase.auth.getSession();
      if (!userSession) return;

      const today = new Date();
      const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const todayStr = getLocalDateString(today);

      // Get current hours and minutes
      const nowHours = today.getHours();
      const nowMinutes = today.getMinutes();
      const currentMinutesFromMidnight = nowHours * 60 + nowMinutes;

      // Fetch students and groups
      const { data: studentsData } = await supabase.from('students').select('*');
      const { data: groupsData } = await supabase.from('groups').select('*, group_students(student_id)');
      const { data: plansData } = await supabase.from('plans').select('*');

      // Fetch today's completed/rescheduled sessions to prevent double notifications
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
      
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', todayStart)
        .lte('date', todayEnd);

      const candidates: NotificationItem[] = [];

      const getMinutesFromMidnight = (timeStr: string): number => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      // Process students
      if (studentsData) {
        studentsData.forEach((student: any) => {
          const schedules = student.schedule || [];
          schedules.forEach((s: any) => {
            const isMatch = s.isOneOff ? s.date === todayStr : s.dayOfWeek === currentDayOfWeek;
            if (!isMatch) return;

            const classTime = s.time;
            const classMinutes = getMinutesFromMidnight(classTime);
            const targetNotificationMinutes = classMinutes - currentSettings.offsetMinutes;

            // Trigger notification if we are in the target notification minute
            if (currentMinutesFromMidnight === targetNotificationMinutes) {
              const uniqueKey = `${student.id}_${classTime}_${todayStr}`;
              if (currentSettings.notifiedKeys.has(uniqueKey)) return;

              // Check if session already completed/rescheduled
              const existingSession = todaySessions?.find((sess: any) => {
                if (sess.reference_id !== student.id || sess.type !== 'student') return false;
                const isTargetOneOff = !!s.isOneOff;
                const isSessOneOff = !!sess.attendee_ids?.isOneOff;
                if (isTargetOneOff !== isSessOneOff) return false;
                if (isTargetOneOff && sess.attendee_ids?.notes?.includes(classTime)) return true;
                if (!isTargetOneOff && !sess.attendee_ids?.class_time) return true;
                return sess.attendee_ids?.class_time === classTime;
              });

              if (existingSession && (existingSession.status === 'completed' || existingSession.status === 'rescheduled')) {
                return;
              }

              const plan = plansData?.find(p => p.id === student.plan_id)?.name || 'Sem Plano';
              candidates.push({
                id: student.id,
                type: 'student',
                name: student.name,
                time: classTime,
                planName: plan,
                scheduleItem: s,
                originalData: student,
                studentIds: [student.id]
              });
            }
          });
        });
      }

      // Process groups
      if (groupsData) {
        groupsData.forEach((group: any) => {
          const schedules = group.schedule || [];
          schedules.forEach((s: any) => {
            const isMatch = s.isOneOff ? s.date === todayStr : s.dayOfWeek === currentDayOfWeek;
            if (!isMatch) return;

            const classTime = s.time;
            const classMinutes = getMinutesFromMidnight(classTime);
            const targetNotificationMinutes = classMinutes - currentSettings.offsetMinutes;

            if (currentMinutesFromMidnight === targetNotificationMinutes) {
              const uniqueKey = `${group.id}_${classTime}_${todayStr}`;
              if (currentSettings.notifiedKeys.has(uniqueKey)) return;

              // Check if session already completed/rescheduled
              const existingSession = todaySessions?.find((sess: any) => {
                if (sess.reference_id !== group.id || sess.type !== 'group') return false;
                const isTargetOneOff = !!s.isOneOff;
                const isSessOneOff = !!sess.attendee_ids?.isOneOff;
                if (isTargetOneOff !== isSessOneOff) return false;
                if (isTargetOneOff && sess.attendee_ids?.notes?.includes(classTime)) return true;
                if (!isTargetOneOff && !sess.attendee_ids?.class_time) return true;
                return sess.attendee_ids?.class_time === classTime;
              });

              if (existingSession && (existingSession.status === 'completed' || existingSession.status === 'rescheduled')) {
                return;
              }

              const plan = plansData?.find(p => p.id === group.plan_id)?.name || 'Sem Plano';
              const studentIds = group.group_students ? group.group_students.map((gs: any) => gs.student_id) : [];

              candidates.push({
                id: group.id,
                type: 'group',
                name: group.name,
                time: classTime,
                planName: plan,
                scheduleItem: s,
                originalData: group,
                studentIds
              });
            }
          });
        });
      }

      // Show the first candidate if there is any, and store the rest in pending notifications list
      if (candidates.length > 0) {
        const firstCandidate = candidates[0];
        const uniqueKey = `${firstCandidate.id}_${firstCandidate.time}_${todayStr}`;
        addNotifiedKey(uniqueKey);
        setActiveNotification(firstCandidate);

        if (candidates.length > 1) {
          setPendingNotifications(prev => [...prev, ...candidates.slice(1)]);
        }
      }

    } catch (error) {
      console.error('Error checking upcoming classes for notifications:', error);
    }
  }, [addNotifiedKey]);

  // Run the checker on mount and every 30 seconds
  useEffect(() => {
    checkUpcomingClasses();
    const interval = setInterval(checkUpcomingClasses, 30000);
    return () => clearInterval(interval);
  }, [checkUpcomingClasses]);

  // Listen to simulation triggers from preferences page
  useEffect(() => {
    const handleSimulate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const mockClass: NotificationItem = customEvent.detail || {
        id: 'simulation-id',
        type: 'group',
        name: 'Aula de Pilates (Grupo)',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        planName: 'Plano Pilates Mensal',
        scheduleItem: { isOneOff: false },
        originalData: {},
        studentIds: []
      };

      setActiveNotification(mockClass);
    };

    window.addEventListener('simulate-notification', handleSimulate);
    return () => window.removeEventListener('simulate-notification', handleSimulate);
  }, []);

  // Listen to live configuration updates from settings page
  useEffect(() => {
    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { enabled: isEnabled, offset: isOffset, platform: isPlatform } = customEvent.detail;
        setEnabled(isEnabled);
        setOffsetMinutes(isOffset);
        if (isPlatform) {
          setPlatform(isPlatform);
        }
      }
    };

    window.addEventListener('notification-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('notification-settings-updated', handleSettingsUpdate);
  }, []);

  // Confirm presence from notification banner directly
  const handleConfirmPresence = async (item: NotificationItem) => {
    setIsConfirming(true);
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

      // Check if session already exists
      const { data: existingSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('reference_id', item.id)
        .eq('type', item.type)
        .gte('date', todayStart)
        .lte('date', todayEnd);

      const sessionData = {
        attendees: item.studentIds || [],
        external_visitors: [],
        paid: false,
        academia_count: 0,
        additional_value: 0,
        class_time: item.time,
        isOneOff: !!item.scheduleItem?.isOneOff
      };

      if (existingSessions && existingSessions.length > 0) {
        // Update existing
        await supabase
          .from('sessions')
          .update({ attendee_ids: sessionData, status: 'completed' })
          .eq('id', existingSessions[0].id);
      } else {
        // Insert new session
        await supabase.from('sessions').insert({
          type: item.type,
          reference_id: item.id,
          date: today.toISOString(),
          status: 'completed',
          attendee_ids: sessionData
        });
      }

      // Success feedback!
      setSuccessToast(`Presença confirmada para ${item.name}!`);
      setTimeout(() => setSuccessToast(null), 3500);

      // Trigger update on agenda/dashboard
      window.dispatchEvent(new CustomEvent('agenda-updated'));

      // Dismiss current notification
      handleDismiss();
    } catch (error) {
      console.error('Error confirming presence from notification:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDismiss = () => {
    setActiveNotification(null);
    // If there is any pending notification, show the next one after a small delay
    if (pendingNotifications.length > 0) {
      setTimeout(() => {
        const next = pendingNotifications[0];
        setPendingNotifications(prev => prev.slice(1));
        const todayStr = getLocalDateString(new Date());
        const uniqueKey = `${next.id}_${next.time}_${todayStr}`;
        addNotifiedKey(uniqueKey);
        setActiveNotification(next);
      }, 600);
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* Toast Notification Success */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e24] border border-[#3e3e4a] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-medium text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Notification Banner Pop-up */}
      <AnimatePresence>
        {activeNotification && (
          <div className="fixed top-4 left-0 right-0 px-4 md:left-auto md:right-4 md:w-[420px] z-50 pointer-events-none">
            {resolvedPlatform === 'ios' ? (
              /* --- iPhone / iOS STYLE POPUP --- */
              <motion.div
                initial={{ y: -80, opacity: 0, scale: 0.93 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -60, opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', damping: 15, stiffness: 130 }}
                className="pointer-events-auto w-full bg-[#151516]/80 backdrop-blur-xl text-white rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col font-sans"
              >
                {/* iOS Header */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <div className="flex items-center gap-2">
                    {/* iOS App Icon Mockup */}
                    <div className="w-5 h-5 rounded-[5px] bg-gradient-to-tr from-[#2c3e50] to-[#3498db] flex items-center justify-center text-[10px] font-black tracking-tighter text-white shadow-inner">
                      B
                    </div>
                    <span className="text-xs font-bold text-white/90 tracking-tight">B-Flow</span>
                    <span className="text-[10px] text-white/40 font-medium">• agora</span>
                  </div>
                  <button 
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* iOS Content */}
                <div className="px-4 pb-3">
                  <h4 className="text-[14px] font-bold text-white tracking-tight leading-tight">
                    Hora da Aula! {activeNotification.time}
                  </h4>
                  <p className="text-[12.5px] text-white/80 mt-1 leading-normal font-normal">
                    Iniciando a aula de <strong className="text-primary font-bold">{activeNotification.name}</strong> ({activeNotification.planName}). Gostaria de marcar presença dos alunos?
                  </p>
                </div>

                {/* iOS Styled Actions */}
                <div className="border-t border-white/10 flex divide-x divide-white/10">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-3 text-xs font-semibold text-white/60 hover:bg-white/5 active:bg-white/5 transition-colors text-center"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={() => handleConfirmPresence(activeNotification)}
                    disabled={isConfirming}
                    className="flex-1 py-3 text-xs font-extrabold text-primary hover:bg-primary/10 active:bg-primary/10 transition-colors text-center flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
                        Confirmar Aula
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* --- Android STYLE POPUP --- */
              <motion.div
                initial={{ y: -100, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -80, opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', damping: 18, stiffness: 120 }}
                className="pointer-events-auto w-full bg-[#1c1c1e] text-white rounded-[28px] shadow-[0_24px_48px_rgba(0,0,0,0.4)] border border-[#2c2c2e]/80 overflow-hidden flex flex-col"
              >
                {/* Android Notification Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    {/* Styled Notification Icon */}
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold tracking-wider text-[#a4a4a8] uppercase">B-Flow</span>
                    <span className="text-xs text-[#7c7c80] font-medium">• agora</span>
                  </div>
                  <button 
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-[#a4a4a8] hover:bg-[#2c2c2e] hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Android Notification Body */}
                <div className="px-5 pb-4">
                  <h4 className="text-[15px] font-bold text-white tracking-tight">
                    Hora da Aula! {activeNotification.time}
                  </h4>
                  <p className="text-sm text-[#d1d1d6] mt-1 font-medium leading-relaxed">
                    Iniciando a aula de <strong className="text-primary font-bold">{activeNotification.name}</strong> ({activeNotification.planName}). Gostaria de marcar presença para os alunos agora?
                  </p>
                </div>

                {/* Android Styled Action Buttons */}
                <div className="flex border-t border-[#2c2c2e] divide-x divide-[#2c2c2e]">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-3.5 text-sm font-bold text-[#a4a4a8] hover:bg-[#2c2c2e] transition-colors"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={() => handleConfirmPresence(activeNotification)}
                    disabled={isConfirming}
                    className="flex-1 py-3.5 text-sm font-extrabold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3px]" />
                        Confirmar Aula
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
