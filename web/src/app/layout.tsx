import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from './providers';
import { DesktopSidebar } from '../components/DesktopSidebar';
import { DesktopRightRail } from '../components/DesktopRightRail';
import { NavigationProgress } from '../components/NavigationProgress';

export const metadata: Metadata = {
  title: 'iwent',
  description: 'Event management application',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Определяем __DEV__ глобально для браузера
  if (typeof window !== 'undefined' && typeof (window as any).__DEV__ === 'undefined') {
    (window as any).__DEV__ = process.env.NODE_ENV !== 'production';
  }
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="p:domain_verify" content="2964b9e6c9db6925615b5343c0777c8e" />
        {/* Определяем __DEV__ глобально ДО загрузки других скриптов */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && typeof window.__DEV__ === 'undefined') {
                window.__DEV__ = ${process.env.NODE_ENV !== 'production'};
              }
              if (typeof global !== 'undefined' && typeof global.__DEV__ === 'undefined') {
                global.__DEV__ = ${process.env.NODE_ENV !== 'production'};
              }
            `,
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, overflowX: 'hidden', overflowY: 'auto' }}>
        <NavigationProgress />
        <Providers>
          <DesktopSidebar />
          <DesktopRightRail />
          {children}
        </Providers>
      </body>
    </html>
  );
}
