'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Динамически импортируем провайдеры из client
const LanguageProvider = dynamic(
  () => import('@/client/context/LanguageContext').then(mod => ({ default: mod.LanguageProvider })),
  { ssr: false }
);

const AuthProvider = dynamic(
  () => import('@/client/context/AuthContext').then(mod => ({ default: mod.AuthProvider })),
  { ssr: false }
);

const EventsProvider = dynamic(
  () => import('@/client/context/EventsContext').then(mod => ({ default: mod.EventsProvider })),
  { ssr: false }
);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <EventsProvider>
          {children}
        </EventsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
