'use client';

import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';

const MemoriesScreen = dynamicImport(
  () => import('@/client/app/(tabs)/memories').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function MemoriesPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <MemoriesScreen />
        <WebTabBar />
      </div>
    </>
  );
}
