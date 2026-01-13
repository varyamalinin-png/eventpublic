'use client';

import dynamicImport from 'next/dynamic';
import DesktopThreeColumnLayout from '../../../components/DesktopThreeColumnLayout';
import { WebTabBar } from '../../../components/WebTabBar';

const MemoriesScreen = dynamicImport(
  () => import('@/client/app/(tabs)/memories').then(mod => ({ default: mod.default })),
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

export default function MemoriesPage() {
  // На десктопе показываем DesktopThreeColumnLayout, на мобильных - MemoriesScreen
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      <div className="desktop-three-column-layout" style={{ display: 'none' }}>
        <DesktopThreeColumnLayout />
      </div>
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <MemoriesScreen />
        <WebTabBar />
      </div>
    </>
  );
}
