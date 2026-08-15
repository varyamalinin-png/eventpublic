'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const AdminMailScreen = dynamic(
  () => import('@/client/app/admin/mail').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function AdminMailPage() {
  return (
    <div className="mobile-layout">
      <div style={{ width: '100%', height: '100vh' }}>
        <AdminMailScreen />
      </div>
    </div>
  );
}
