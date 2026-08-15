'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { Providers } from '../providers';

const FriendsListScreen = dynamic(
  () => import('@/client/app/friends-list').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function FriendsListPage() {
  return (
    <Providers>
      <div style={{ width: '100%', height: '100vh' }}>
        <FriendsListScreen />
      </div>
    </Providers>
  );
}

