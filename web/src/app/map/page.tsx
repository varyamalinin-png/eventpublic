'use client';

import dynamic from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

// На вебе нужна именно map.web: map.tsx реэкспортирует map.native (react-native-maps), что в Next даёт undefined → React error #130
const MapScreen = dynamic(
  () => import('@/client/app/map.web').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function MapPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <div style={{ width: '100%', height: '100vh' }}>
          <MapScreen />
        </div>
      </div>
    </>
  );
}
