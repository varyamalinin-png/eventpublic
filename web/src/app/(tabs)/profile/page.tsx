'use client';

import dynamicImport from 'next/dynamic';
import { Providers } from '../../providers';

const ProfileScreen = dynamicImport(
  () => import('@/client/app/(tabs)/profile').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <LoadingScreen /> }
);

const WebTabBar = dynamicImport(
  () => import('../../../components/WebTabBar').then(mod => ({ default: mod.WebTabBar })),
  { ssr: false }
);

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#0f0f0f',
      color: '#8B5CF6'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <Providers>
      <div style={{ width: '100%', minHeight: '100vh', paddingBottom: '60px' }}>
        <ProfileScreen />
      </div>
      <WebTabBar />
    </Providers>
  );
}

