import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

/**
 * Гостевой гейт для экранов, закрытых без аккаунта.
 *
 * Нажатия на таб-бар перехватывает guestGuardListeners в (tabs)/_layout.tsx,
 * но прямые диплинки (iwent://map, /calendar, /create, /profile/<id> и т.п.)
 * и переходы внутри разделов попадают на экран в обход таб-бара. Этот хук —
 * вторая линия защиты: гостю делаем replace на регистрацию, а экран до этого
 * момента ничего не рендерит (вызывающий должен сделать `if (isGuest) return null`
 * ПОСЛЕ всех остальных хуков).
 *
 * Возвращает true, пока пользователь — гость (или сессия ещё читается и
 * гостевой статус не опровергнут): экран в это время не должен показывать
 * защищённый контент и не должен слать авторизованные запросы.
 */
export function useGuestGate(): boolean {
  const { user, initializing } = useAuth();
  const router = useRouter();
  // Пока идёт инициализация, гостем не считаем — иначе залогиненный
  // пользователь при холодном старте по диплинку сначала мельком улетал бы
  // на регистрацию и возвращался обратно.
  const isGuest = !initializing && !user;

  useEffect(() => {
    if (!isGuest) return;
    // Небольшая отсрочка: replace, брошенный в момент маунта экрана по
    // диплинку, может проиграть гонку с самой навигацией диплинка — тогда
    // гость остаётся на белом экране. 100 мс незаметны (экран всё это время
    // рендерит null), а навигация успевает завершиться. Страховкой служит
    // гейт на уровне (tabs)/_layout.tsx.
    const timer = setTimeout(() => {
      router.replace('/(auth)/login?mode=register');
    }, 100);
    return () => clearTimeout(timer);
  }, [isGuest, router]);

  return isGuest;
}
