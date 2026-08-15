'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const RequestsScreen = dynamic(
  () => import('@/client/app/(tabs)/inbox/requests/index').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function RequestsPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <RequestsScreen />
      </div>
    </>
  );
}

