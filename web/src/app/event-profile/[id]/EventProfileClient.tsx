'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageLoading } from '@/web/components/PageLoading';
import { PublicEventPreview } from '@/web/components/PublicEventPreview';
import { hasStoredSession } from '@/web/lib/publicPage';
import { Providers } from '../../providers';

const EventProfileScreen = dynamic(
  () => import('@/client/screens/EventProfileScreen').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

export default function EventProfileClient() {
  const params = useParams<{ id: string }>();
  const eventId = typeof params?.id === 'string' ? params.id : '';
  // Хранилище читаем только после монтирования: на сервере его нет, и без
  // этого разметка сервера и клиента разошлась бы.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setSignedIn(hasStoredSession());
  }, []);

  if (signedIn === null) return <PageLoading />;
  if (!signedIn) return <PublicEventPreview eventId={eventId} />;

  return (
    <Providers>
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout">
        <div style={{ width: '100%', height: '100vh' }}>
          <EventProfileScreen />
        </div>
      </div>
    </Providers>
  );
}
