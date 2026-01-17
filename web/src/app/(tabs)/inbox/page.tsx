'use client';

import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';

const InboxScreen = dynamicImport(
  () => import('@/client/app/(tabs)/inbox').then(mod => ({ default: mod.default })),
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

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <InboxScreen />
        <WebTabBar />
      </div>
    </>
  );
}
