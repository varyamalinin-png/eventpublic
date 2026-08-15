'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/client/context/AuthContext';
import { PageLoading } from '@/web/components/PageLoading';

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

  return <PageLoading />;
}

export default function Home() {
  return <AppContent />;
}
