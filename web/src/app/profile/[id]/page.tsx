'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PageLoading } from '@/web/components/PageLoading';
import { PublicSignInPrompt } from '@/web/components/PublicSignInPrompt';
import { hasStoredSession } from '@/web/lib/publicPage';
import { Providers } from '../../providers';
// Чужой профиль лежит вне группы (tabs), поэтому общий web-layout с панелью
// на него не распространяется. Без этого импорта здесь оставалась старая
// панель из client/components/MiniTabBar — «другое меню» только на этой
// странице.
import { WebTabBar } from '../../../components/WebTabBar';

const ProfileScreen = dynamic(
  () => import('@/client/screens/UserProfileScreen').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);


export default function ProfilePage() {
  // Профиль требует авторизации (GET /users/:id отвечает 401 анониму), поэтому
  // без входа рисуем заглушку, а не пустой каркас с именем «user» и нулями.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    setSignedIn(hasStoredSession());
  }, []);

  if (signedIn === null) return <PageLoading />;
  if (!signedIn) return <PublicSignInPrompt />;

  return (
    <Providers>
      <div className="mobile-layout profile-page-scroll">
        <div
          style={{
            width: '100%',
            height: '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <ProfileScreen />
        </div>
        <WebTabBar />
      </div>
    </Providers>
  );
}
