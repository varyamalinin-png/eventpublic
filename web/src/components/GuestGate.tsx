'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasStoredSession } from '@/web/lib/publicPage';

/**
 * Гостевой режим: без аккаунта открыты только публичные страницы
 * (лента Explore с заблюренными параметрами, превью события/профиля,
 * авторизация и юридические документы). Всё остальное уводит гостя
 * на регистрацию. Клики по табам перехватываются раньше — в WebTabBar
 * и DesktopSidebar; этот гейт ловит прямые заходы по URL и разлогин
 * на защищённой странице.
 */

// Точные публичные пути.
const PUBLIC_EXACT = new Set([
  '/',
  '/explore',
  '/login',
  '/verify-email',
  '/reset-password',
  '/add-account',
  '/add-account-verify',
  '/terms',
  '/privacy',
]);

// Публичные префиксы (динамические маршруты и группы).
// /profile/[id] — публичное превью профиля, но сама /profile (свой профиль)
// защищена, поэтому префикс именно с косой чертой.
const PUBLIC_PREFIXES = ['/event-profile/', '/event/', '/profile/', '/auth/'];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true; // пока путь неизвестен — не дёргаем роутер
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (PUBLIC_EXACT.has(clean)) return true;
  return PUBLIC_PREFIXES.some((p) => clean.startsWith(p));
}

export function GuestGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPublicPath(pathname)) return;
    if (!hasStoredSession()) {
      router.replace('/login?mode=register');
    }
  }, [pathname, router]);

  return null;
}
