'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Тонкий прогресс-бар в верхней части экрана — мгновенный визуальный отклик
 * при навигации между разделами. Не требует внешних зависимостей.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPath = useRef(pathname);

  // Запускаем бар при смене pathname
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const bar = barRef.current;
    if (!bar) return;

    // Сбрасываем предыдущую анимацию
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animRef.current) clearTimeout(animRef.current);

    // Мгновенно показываем бар в начале
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.style.opacity = '1';

    // Быстрый старт — до 85% с ускорением
    requestAnimationFrame(() => {
      bar.style.transition = 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      bar.style.width = '85%';

      // Завершаем через 120мс
      timerRef.current = setTimeout(() => {
        bar.style.transition = 'width 0.18s ease-out';
        bar.style.width = '100%';
        // Фэйдаут
        animRef.current = setTimeout(() => {
          bar.style.transition = 'opacity 0.22s ease';
          bar.style.opacity = '0';
          animRef.current = setTimeout(() => {
            bar.style.width = '0%';
          }, 240);
        }, 180);
      }, 120);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, [pathname]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 999999,
        pointerEvents: 'none',
      }}
    >
      <div
        ref={barRef}
        style={{
          height: '100%',
          width: '0%',
          opacity: 0,
          background: 'linear-gradient(90deg, #FF8D32 0%, #ffb366 100%)',
          boxShadow: '0 0 8px rgba(255,141,50,0.7)',
          borderRadius: '0 2px 2px 0',
          willChange: 'width, opacity',
        }}
      />
    </div>
  );
}
