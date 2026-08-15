'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const CalendarScreen = dynamic(
  () => import('@/client/app/calendar').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function CalendarPage() {
  return (
    <div
      className="mobile-layout"
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <CalendarScreen />
      </div>
    </div>
  );
}
