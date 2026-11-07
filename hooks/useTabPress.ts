import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Повторный тап по уже активной вкладке.
 *
 * Почему не просто `navigation.addListener('tabPress')`: событие приходит на
 * экран, который является ПРЯМЫМ ребёнком таб-навигатора. С постабными стеками
 * (CLAUDE.md §1.1) таким ребёнком стал стек раздела, а не сама лента — и
 * слушатель, повешенный внутри экрана, не срабатывал вовсе. Отсюда и «повторное
 * нажатие не откатывает ленту к началу»: код был, но события не получал.
 *
 * Поэтому подписываемся на всю цепочку родителей. Обычный переход между
 * вкладками при этом не задет: колбэк вызывается, только когда экран УЖЕ
 * в фокусе, то есть человек нажал на раздел, в котором и находится.
 */
export function useTabPress(onRepeatTap: () => void) {
  const navigation = useNavigation();
  const callbackRef = useRef(onRepeatTap);
  callbackRef.current = onRepeatTap;

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    // Одно нажатие — один вызов, даже если событие долетит по двум веткам.
    let lastHandledAt = 0;

    const handle = () => {
      const now = Date.now();
      if (now - lastHandledAt < 300) return;
      lastHandledAt = now;
      if ((navigation as any).isFocused?.()) callbackRef.current();
    };

    let current: any = navigation;
    while (current) {
      if (typeof current.addListener === 'function') {
        try {
          const unsubscribe = current.addListener('tabPress', handle);
          if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe);
        } catch {
          // Навигатор без вкладок такого события не знает — это нормально.
        }
      }
      current = typeof current.getParent === 'function' ? current.getParent() : null;
    }

    return () => {
      unsubscribers.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch {
          // Навигатор мог быть размонтирован раньше.
        }
      });
    };
  }, [navigation]);
}
