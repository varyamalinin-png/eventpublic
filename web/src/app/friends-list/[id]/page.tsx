'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const FriendsListDetailScreen = dynamic(
  () => import('@/client/app/friends-list/[id]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function FriendsListDetailPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
      <div style={{ width: '100%', height: '100vh' }}>
        <FriendsListDetailScreen />
        </div>
      </div>
    </>
  );
}

