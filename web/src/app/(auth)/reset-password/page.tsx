'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { Providers } from '../../providers';

const ResetPasswordScreen = dynamic(
  () => import('@/client/app/(auth)/reset-password').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function ResetPasswordPage() {
  return (
    <Providers>
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', height: '100vh', padding: '0 20px', boxSizing: 'border-box' as const }}>
        <ResetPasswordScreen />
      </div>
    </Providers>
  );
}
