export const dynamic = 'force-dynamic';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { FinanceProvider } from '@/components/FinanceContext';
import { PWAInstall } from '@/components/PWAInstall';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1c1c1e',
};

export const metadata: Metadata = {
  title: 'B-Flow - Gestão para Personal',
  description: 'Aplicativo de gestão para professores e personal trainers.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'B-Flow',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.className} suppressHydrationWarning>
      <body className="bg-background text-on-background min-h-screen relative antialiased flex flex-col md:flex-row" suppressHydrationWarning>
        <PWAInstall />
        <FinanceProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </FinanceProvider>
      </body>
    </html>
  );
}
