'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Providers } from '../providers';
import { useAuth } from '@/client/context/AuthContext';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Google OAuth возвращает токен в hash фрагменте (#id_token=...)
        // Извлекаем id_token из hash или из query параметров
        let idToken: string | null = null;
        let error: string | null = null;

        if (typeof window !== 'undefined') {
          console.log('OAuth callback - Current URL:', window.location.href);
          console.log('OAuth callback - Hash:', window.location.hash);
          console.log('OAuth callback - Search:', window.location.search);

          // Проверяем hash фрагмент (Google обычно возвращает токен в hash)
          if (window.location.hash) {
            const hashStr = window.location.hash.substring(1);
            console.log('OAuth callback - Hash string:', hashStr);
            const hashParams = new URLSearchParams(hashStr);
            idToken = hashParams.get('id_token');
            error = hashParams.get('error');
            console.log('OAuth callback - id_token from hash:', idToken ? 'found' : 'not found');
            console.log('OAuth callback - error from hash:', error);
          }
          
          // Если токена нет в hash, проверяем query параметры
          if (!idToken && !error && window.location.search) {
            const searchStr = window.location.search.substring(1);
            const searchParamsObj = new URLSearchParams(searchStr);
            idToken = searchParamsObj.get('id_token');
            error = searchParamsObj.get('error');
            console.log('OAuth callback - id_token from query:', idToken ? 'found' : 'not found');
            console.log('OAuth callback - error from query:', error);
          }
        } else {
          // Fallback для SSR
          idToken = searchParams.get('id_token');
          error = searchParams.get('error');
        }

        if (error) {
          console.error('Google OAuth error:', error);
          router.replace('/login?error=' + encodeURIComponent(String(error)));
          return;
        }

        if (!idToken) {
          console.error('No id_token in callback');
          console.log('Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
          // Если нет токена, просто показываем сообщение, не делаем редирект
          // чтобы избежать бесконечных редиректов
          setTimeout(() => {
            router.replace('/login?error=no_token');
          }, 2000);
          return;
        }

        console.log('OAuth callback - Calling loginWithGoogle with token length:', idToken.length);
        // Вызываем loginWithGoogle с полученным токеном
        await loginWithGoogle(idToken);
        console.log('OAuth callback - loginWithGoogle succeeded, redirecting to /');
        // После успешной авторизации перенаправляем в приложение
        router.replace('/');
      } catch (error: any) {
        console.error('Failed to login with Google:', error);
        const errorMessage = error?.message || error?.toString() || 'Не удалось войти через Google';
        // Убеждаемся, что сообщение об ошибке не содержит HTML
        const cleanErrorMessage = errorMessage.replace(/<[^>]*>/g, '').substring(0, 200);
        router.replace('/login?error=' + encodeURIComponent(cleanErrorMessage));
      }
    };

    handleAuthCallback();
  }, [searchParams, loginWithGoogle, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF8D32" />
      <Text style={styles.text}>Авторизация через Google...</Text>
    </View>
  );
}

function AuthCallbackWrapper() {
  return (
    <Suspense fallback={
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF8D32" />
        <Text style={styles.text}>Загрузка...</Text>
      </View>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

export default function AuthCallbackPage() {
  return (
    <Providers>
      <AuthCallbackWrapper />
    </Providers>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    gap: 16,
  },
  text: {
    color: '#FFF',
    fontSize: 16,
  },
});

