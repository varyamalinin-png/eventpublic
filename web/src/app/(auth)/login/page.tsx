'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { PageLoading } from '@/web/components/PageLoading';
import { useLanguage } from '@/client/context/LanguageContext';

const LoginScreen = dynamic(
  () => import('@/client/app/(auth)/login').then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => <PageLoading /> }
);

function IwentWordmark() {
  return (
    <div
      aria-label="iwent"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 28,
        paddingBottom: 14,
        userSelect: 'none',
      }}
    >
      <Image
        src="/auth-wordmark.png"
        alt="iwent"
        width={360}
        height={108}
        priority
        sizes="(max-width: 500px) 72vw, 360px"
        style={{
          width: 360,
          height: 'auto',
          display: 'block',
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLanguage();
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}
    >
      <IwentWordmark />
      <div style={{ flex: 1 }}>
        <LoginScreen />
      </div>
      <div
        style={{
          padding: '12px 20px 20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.78)',
          fontSize: 13,
        }}
      >
        <Link
          href="/privacy"
          style={{
            color: '#f0f0f0',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {t.desktop.privacyPolicy}
        </Link>
      </div>
    </div>
  );
}

