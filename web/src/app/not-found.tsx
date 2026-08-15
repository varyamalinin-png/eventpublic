'use client';

import dynamic from 'next/dynamic';
import { Providers } from './providers';
import { PageLoading } from '@/web/components/PageLoading';

const NotFoundScreen = dynamic(
  () => import('@/client/app/+not-found').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function NotFound() {
  return (
    <Providers>
      <div style={{ width: '100%', height: '100vh' }}>
        <NotFoundScreen />
      </div>
    </Providers>
  );
}

