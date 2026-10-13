'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname, useRouter } from 'next/navigation';
import { Navigation } from './Navigation';
import { Loader2 } from 'lucide-react';
import { AndroidNotificationManager } from './AndroidNotificationManager';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
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
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      <div className="flex-1 w-full md:pl-[280px]">
        {children}
      </div>
    </>
  );
}
