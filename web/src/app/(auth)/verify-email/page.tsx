'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { Providers } from '../../providers';

const VerifyEmailScreen = dynamic(
  () => import('@/client/app/(auth)/verify-email').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function VerifyEmailPage() {
  return (
    <Providers>
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', height: '100vh', padding: '0 20px', boxSizing: 'border-box' as const }}>
        <VerifyEmailScreen />
      </div>
    </Providers>
  );
}

