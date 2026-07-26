'use client';

import dynamicImport from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';

const SavedScreen = dynamicImport(
  () => import('@/client/app/(tabs)/saved').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function SavedPage() {
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <SavedScreen />
      </div>
    </>
  );
}
