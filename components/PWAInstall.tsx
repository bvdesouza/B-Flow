'use client';

import { useEffect } from 'react';

export function PWAInstall() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Dentro do app nativo (Capacitor) o service worker não é necessário
    // e pode servir arquivos antigos do cache depois de uma atualização.
    const isNativeApp = Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isNativeApp) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        },
        (err) => {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
