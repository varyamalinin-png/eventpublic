'use client';

import { useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';
import { useLanguage } from '@/client/context/LanguageContext';

const MemoriesScreen = dynamicImport(
  () => import('@/client/app/(tabs)/memories').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function MemoriesPage() {
  const { language } = useLanguage();
  useEffect(() => { document.title = language === 'ru' ? 'Воспоминания — iwent' : 'Memories — iwent'; }, [language]);
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
