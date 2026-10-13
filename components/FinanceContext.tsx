'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FinanceContextType {
  isFinanceVisible: boolean;
  toggleFinanceVisibility: () => void;
  formatCurrency: (value: number) => string;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [isFinanceVisible, setIsFinanceVisible] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('finance_visible');
    const value = stored === 'true';
    
    // Defer state updates to avoid synchronous cascading render warnings in strict linters
    setTimeout(() => {
      setIsFinanceVisible(value);
      setIsMounted(true);
    }, 0);
  }, []);

  const toggleFinanceVisibility = () => {
    setIsFinanceVisible((prev) => {
      const newVal = !prev;
      localStorage.setItem('finance_visible', String(newVal));
      return newVal;
    });
  };

  const formatCurrency = (value: number) => {
    if (!isMounted || !isFinanceVisible) {
      return 'R$ ••••';
    }
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <FinanceContext.Provider value={{ isFinanceVisible, toggleFinanceVisibility, formatCurrency }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}

export function FinanceEyeButton({ className = "" }: { className?: string }) {
  const { isFinanceVisible, toggleFinanceVisibility } = useFinance();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFinanceVisibility();
      }}
      className={`p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all active:scale-95 duration-200 ${className}`}
      title={isFinanceVisible ? "Ocultar Valores Financeiros" : "Mostrar Valores Financeiros"}
      type="button"
    >
      {isFinanceVisible ? (
        <EyeOff className="w-5 h-5" />
      ) : (
        <Eye className="w-5 h-5" />
      )}
    </button>
  );
}
