import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Event App',
  description: 'Event management application',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
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
      <body style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
