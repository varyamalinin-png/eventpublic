'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { Providers } from '../../providers';

const ProfileScreen = dynamic(
  () => import('@/client/app/profile/[id]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function ProfilePage() {
  return (
    <Providers>
      <div className="mobile-layout profile-page-scroll">
        <div
          style={{
            width: '100%',
            height: '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <ProfileScreen />
        </div>
      </div>
    </Providers>
  );
}
