'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { Providers } from '../../providers';

const EventProfileScreen = dynamic(
  () => import('@/client/app/event-profile/[id]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function EventProfilePage() {
  return (
    <Providers>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
      <div style={{ width: '100%', height: '100vh' }}>
        <EventProfileScreen />
        </div>
      </div>
    </Providers>
  );
}

