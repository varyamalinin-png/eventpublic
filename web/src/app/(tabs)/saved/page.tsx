'use client';

import { useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { PageLoading } from '@/web/components/PageLoading';
import { useLanguage } from '@/client/context/LanguageContext';

const SavedScreen = dynamicImport(
  () => import('@/client/app/(tabs)/saved').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function SavedPage() {
  const { language } = useLanguage();
  useEffect(() => { document.title = language === 'ru' ? 'Сохраненные — iwent' : 'Saved — iwent'; }, [language]);
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
