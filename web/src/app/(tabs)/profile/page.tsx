'use client';

import dynamicImport from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { WebTabBar } from '../../../components/WebTabBar';
import { PageLoading } from '@/web/components/PageLoading';

const ProfileScreen = dynamicImport(
  () => import('@/client/app/(tabs)/profile').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);



export default function ProfilePage() {
  const router = useRouter();

  return (
    <>
      {/* Десктопный layout - показывается через CSS media queries на экранах >= 768px */}
      
      {/* Мобильный layout - показывается по умолчанию, скрывается через CSS на десктопе */}
      <div className="mobile-layout" style={{ position: 'relative' }}>
        {/* Минималистичная кнопка настроек профиля (карандаш) */}
        <button
          type="button"
          onClick={() => router.push('/settings')}
          aria-label="Profile settings"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'rgba(18,18,18,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            color: '#ffffff',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ✏️
        </button>
        <ProfileScreen />
        <WebTabBar />
      </div>
    </>
  );
}
