'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/client/context/AuthContext';
import { PageLoading } from '@/web/components/PageLoading';

function AppContent() {
  const router = useRouter();
  const { initializing } = useAuth();

  useEffect(() => {
    if (!initializing) {
      // Гостевой режим: лента открыта и без аккаунта (параметры заблюрены).
      router.replace('/explore');
    }
  }, [initializing, router]);

  return <PageLoading />;
}

export default function Home() {
  return <AppContent />;
}
