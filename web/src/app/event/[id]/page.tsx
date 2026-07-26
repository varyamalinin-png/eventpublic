'use client';

import dynamic from 'next/dynamic';
import { Providers } from '../../providers';

// Используем event-profile вместо event, так как файл event/[id] не существует
const EventScreen = dynamic(
  () => import('@/client/app/event-profile/[id]').then(mod => ({ default: mod.default })),
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
      color: '#FF8D32'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );
}

export default function EventPage() {
  return (
    <Providers>
      <div style={{ width: '100%', height: '100vh' }}>
        <EventScreen />
      </div>
    </Providers>
  );
}

