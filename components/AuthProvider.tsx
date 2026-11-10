'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from './Navigation';
import { Loader2 } from 'lucide-react';
import { AndroidNotificationManager } from './AndroidNotificationManager';
import { BrandLogoFull } from './BrandLogo';

// Páginas que qualquer pessoa pode abrir sem login (exigidas pela Play Store e App Store).
const PUBLIC_PATHS = ['/privacidade', '/excluir-conta'];
const normalizePath = (path: string | null) => (path && path.length > 1 ? path.replace(/\/+$/, '') : path || '/');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = normalizePath(usePathname());
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (isPublicPage) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return <ProtectedApp pathname={pathname}>{children}</ProtectedApp>;
}

function ProtectedApp({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session && pathname !== '/login') {
        router.push('/login');
      } else if (session && pathname === '/login') {
        router.push('/');
      }
    }).catch((err) => {
      console.error('Error fetching session:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (!session && pathname !== '/login') {
        router.push('/login');
      } else if (session && pathname === '/login') {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-black">
        <BrandLogoFull width={220} className="animate-in fade-in zoom-in-95 duration-700" />
        <Loader2 className="w-6 h-6 animate-spin text-[#34d399]" />
      </div>
    );
  }

  // If on login page, don't show navigation
  if (pathname === '/login') {
    return <main className="flex-1 w-full">{children}</main>;
  }

  // Show app layout
  return (
    <>
      {session && <Navigation session={session} />}
      {session && <AndroidNotificationManager />}
      <div className="flex-1 w-full md:pl-[280px]" style={{ paddingTop: 'var(--sat)' }}>
        {children}
      </div>
    </>
  );
}
