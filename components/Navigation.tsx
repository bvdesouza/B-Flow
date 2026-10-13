'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, Users, PieChart, Dumbbell, Settings, Bell, LogOut, User as UserIcon } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { FinanceEyeButton } from './FinanceContext';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icon: Users },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/planos', label: 'Planos', icon: Dumbbell },
  { href: '/relatorios', label: 'Relatórios', icon: PieChart },
];

export function Navigation({ session }: { session: any }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const userMeta = session?.user?.user_metadata || {};
  const trainerName = userMeta.preferred_name || userMeta.full_name || 'Treinador(a)';
  const trainerImage = userMeta.avatar_url || '';

  return (
    <>
      <header className="fixed top-0 w-full z-40 bg-surface/80 backdrop-blur-md flex justify-between items-center px-margin-mobile h-[64px] border-b border-outline-variant/20 md:hidden">
        <div className="flex items-center gap-3">
          <Link href="/configuracoes">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-surface-container-high relative flex items-center justify-center bg-surface-container">
              {trainerImage ? (
                <Image src={trainerImage} alt="Trainer Profile" fill referrerPolicy="no-referrer" className="object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-on-surface-variant" />
              )}
            </div>
          </Link>
        </div>
        <h1 className="font-headline-lg-mobile text-[24px] font-bold text-primary">B-Flow</h1>
        <div className="flex items-center gap-1">
          <FinanceEyeButton />
          <button onClick={handleLogout} aria-label="logout" className="flex items-center justify-center w-10 h-10 rounded-full text-error hover:bg-error/10 transition-colors duration-200">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <aside className="hidden md:flex flex-col h-screen w-[280px] rounded-r-xl bg-surface-container-low border-r border-outline-variant shadow-xl fixed left-0 top-0 py-stack-lg z-40">
        <div className="px-6 mb-8 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h1 className="font-title-lg text-title-lg text-primary font-bold">B-Flow</h1>
            <FinanceEyeButton />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-12 h-12 rounded-full overflow-hidden relative flex items-center justify-center bg-surface-container">
              {trainerImage ? (
                <Image src={trainerImage} alt="Trainer Profile" fill referrerPolicy="no-referrer" className="object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-on-surface-variant" />
              )}
            </div>
            <div>
              <p className="font-label-lg text-label-lg font-bold text-on-surface line-clamp-1">{trainerName}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Plano Premium</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-full transition-all duration-300 ease-in-out ${
                  isActive 
                    ? 'bg-primary-container text-on-primary-container font-bold' 
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="font-label-lg text-label-lg">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        
        <div className="px-4 mt-auto flex flex-col gap-2">
          <Link href="/configuracoes" className={`flex items-center gap-3 mx-2 px-4 py-3 rounded-full transition-all duration-300 ease-in-out ${pathname === '/configuracoes' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <Settings className="w-6 h-6" />
            <span className="font-label-lg text-label-lg">Configurações</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-3 text-error mx-2 px-4 py-3 hover:bg-error/10 rounded-full transition-all duration-300 ease-in-out font-label-lg text-label-lg text-left">
            <LogOut className="w-6 h-6" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center pt-base pb-[calc(env(safe-area-inset-bottom,16px)+8px)] px-gutter z-50 rounded-t-xl bg-surface-container shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
         {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
               <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 px-1 group outline-none">
                <div className={`flex flex-col items-center justify-center rounded-full px-4 py-1 scale-95 active:scale-90 transition-all duration-150 ${
                  isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                </div>
                <span className={`text-[9px] sm:text-[11px] font-medium w-full text-center truncate ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                  {item.label}
                </span>
              </Link>
            )
         })}
      </nav>
    </>
  );
}
