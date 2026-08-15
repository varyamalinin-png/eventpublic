'use client';

import { useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';
import { useLanguage } from '@/client/context/LanguageContext';

const CreateScreen = dynamicImport(
  () => import('@/client/app/(tabs)/create').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function CreatePage() {
  const { language } = useLanguage();
  useEffect(() => { document.title = language === 'ru' ? 'Создать событие — iwent' : 'Create event — iwent'; }, [language]);
  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <CreateScreen />
        <WebTabBar />
      </div>
    </>
  );
}
