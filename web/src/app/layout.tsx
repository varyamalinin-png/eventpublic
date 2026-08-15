import type { Metadata } from 'next';
import '../styles/globals.css';
import { Providers } from './providers';
import { DesktopSidebar } from '../components/DesktopSidebar';
import { DesktopRightRail } from '../components/DesktopRightRail';
import { NavigationProgress } from '../components/NavigationProgress';

export const metadata: Metadata = {
  title: 'iwent — события рядом',
  description:
    'Находи события, организовывай встречи, общайся с друзьями',
  keywords: [
    'события', 'мероприятия', 'кино', 'встречи', 'iwent',
    'найти событие', 'создать событие', 'карта событий',
  ],
  openGraph: {
    title: 'iwent — любые события',
    description:
      'Находите события рядом, создавайте свои и делитесь воспоминаниями вместе с теми, кто вам важен.',
    url: 'https://iwent.ru',
    siteName: 'iwent',
    locale: 'ru_RU',
    type: 'website',
    images: [
      {
        url: 'https://iwent.ru/auth-wordmark.png',
        width: 860,
        height: 258,
        alt: 'iwent — любые события',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'iwent — любые события',
    description:
      'Находите события рядом, создавайте свои и делитесь воспоминаниями.',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: { url: '/favicon-180.png', sizes: '180x180' },
  },
  metadataBase: new URL('https://iwent.ru'),
  alternates: {
    canonical: 'https://iwent.ru',
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
        <meta name="p:domain_verify" content="2964b9e6c9db6925615b5343c0777c8e" />
        <meta name="yandex-verification" content="" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0c" />
        <link rel="icon" href="/favicon.png" sizes="64x64" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon-180.png" sizes="180x180" />
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
