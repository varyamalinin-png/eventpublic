'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Providers } from './providers';
import { useAuth } from '@/client/context/AuthContext';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f0f0f',
      color: '#8B5CF6'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );
}

function AppContent() {
  const router = useRouter();
  const { isAuthenticated, initializing } = useAuth();

  useEffect(() => {
    if (!initializing) {
      if (isAuthenticated) {
        router.replace('/explore');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, initializing, router]);

  return <LoadingScreen />;
}

export default function Home() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
