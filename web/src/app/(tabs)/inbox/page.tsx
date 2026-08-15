'use client';

import { useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';
import { useLanguage } from '@/client/context/LanguageContext';

const InboxScreen = dynamicImport(
  () => import('@/client/app/(tabs)/inbox').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);




export default function InboxPage() {
  const { language } = useLanguage();
  useEffect(() => { document.title = language === 'ru' ? 'Входящие — iwent' : 'Inbox — iwent'; }, [language]);
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
