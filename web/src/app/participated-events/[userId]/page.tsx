'use client';

import dynamic from 'next/dynamic';
import { Providers } from '../../providers';

const ParticipatedEventsScreen = dynamic(
  () => import('@/client/app/participated-events/[userId]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <LoadingScreen /> }
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

export default function ParticipatedEventsPage() {
  return (
    <Providers>
      <div style={{ width: '100%', height: '100vh' }}>
        <ParticipatedEventsScreen />
      </div>
    </Providers>
  );
}

