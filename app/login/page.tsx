'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dumbbell, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredName, setPreferredName] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem.');
        }

        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              preferred_name: preferredName
            }
          }
        });
        if (authError) throw authError;
        alert("Conta criada com sucesso! Verifique seu email ou tente fazer login, dependendo das configurações do Supabase.");
        setIsLogin(true);
      }
      
      if (isLogin) {
         router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-surface-container rounded-3xl p-8 shadow-xl border border-outline-variant/30 overflow-y-auto max-h-[90vh]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
            <Dumbbell className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-on-surface">B-[Flow]</h1>
          <p className="text-on-surface-variant mt-2 text-center">
            {isLogin ? 'Faça login para continuar' : 'Crie sua conta para começar'}
          </p>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl mb-6 font-bold text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Nome Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Como gostaria de ser chamado?</label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                  placeholder="Seu apelido ou nome profissional"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-on-surface font-bold ml-1">Número de Telefone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-md text-on-surface font-bold ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
              placeholder="seu@email.com"
              required
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-on-surface font-bold ml-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {!isLogin && (
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-on-surface font-bold ml-1">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface py-3 px-4 rounded-xl border border-outline-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-4 bg-primary text-on-primary font-bold font-label-lg rounded-full hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5" /> Entrar
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Criar Conta
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-outline-variant/30 pt-6">
          <p className="text-on-surface-variant font-body-sm">
            {isLogin ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}
          </p>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-primary font-bold hover:underline mt-1 focus:outline-none"
          >
            {isLogin ? 'Criar nova conta' : 'Fazer login'}
          </button>
        </div>
      </div>
    </div>
  );
}
