'use client';

import dynamicImport from 'next/dynamic';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';

const EventFolderScreen = dynamicImport(
  () => import('@/client/app/event-folder/[id]').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export const dynamic = 'force-dynamic';

export default function EventFolderPage() {
  return (
    <>
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <EventFolderScreen />
        <WebTabBar />
      </div>
    </>
  );
}
