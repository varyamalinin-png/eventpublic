'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/client/context/AuthContext';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        let idToken: string | null = null;
        let error: string | null = null;

        if (typeof window !== 'undefined') {
          if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            idToken = hashParams.get('id_token');
            error = hashParams.get('error');
          }
          if (!idToken && !error && window.location.search) {
            const searchParamsObj = new URLSearchParams(window.location.search.substring(1));
            idToken = searchParamsObj.get('id_token');
            error = searchParamsObj.get('error');
          }
        } else {
          idToken = searchParams.get('id_token');
          error = searchParams.get('error');
        }

        if (error) {
          router.replace('/login?error=' + encodeURIComponent(String(error)));
          return;
        }

        if (!idToken) {
          setTimeout(() => {
            router.replace('/login?error=no_token');
          }, 2000);
          return;
        }

        await loginWithGoogle(idToken);
        // После успешной авторизации через Google сразу переходим на основной экран с контентом.
        // Для веба используем полную перезагрузку страницы, чтобы гарантировать корректную инициализацию всех провайдеров и данных.
        if (typeof window !== 'undefined') {
          window.location.href = '/explore';
        } else {
          router.replace('/explore');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const clean = errorMessage.replace(/<[^>]*>/g, '').substring(0, 200);
        router.replace('/login?error=' + encodeURIComponent(clean));
      }
    };

    handleAuthCallback();
  }, [searchParams, loginWithGoogle, router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        gap: 16,
      }}
    >
      <div style={{ width: 32, height: 32, border: '3px solid #ff8d32', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: '#FFF', fontSize: 16 }}>Авторизация через Google...</span>
    </div>
  );
}

function AuthCallbackWrapper() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#0f0f0f',
            gap: 16,
          }}
        >
          <span style={{ color: '#ff8d32' }}>Загрузка...</span>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

export default function AuthCallbackPage() {
  return <AuthCallbackWrapper />;
}
