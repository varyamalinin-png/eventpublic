import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, type ImageProps } from 'react-native';

let ExpoImage: any = null;
if (Platform.OS !== 'web') {
  try { ExpoImage = require('expo-image').Image; } catch {}
}

/**
 * Обёртка над Image, которая на вебе откладывает загрузку изображения до момента,
 * когда оно приближается к видимой области экрана (через IntersectionObserver).
 *
 * Зачем: react-native-web грузит каждое изображение сразу при монтировании
 * (через ImageLoader.load в useEffect), независимо от того, видно ли оно —
 * из-за этого длинная лента (события/воспоминания) разом запрашивает десятки
 * полноразмерных картинок (по 100-400кб каждая) и всё тормозит/долго грузится.
 *
 * Решение: пока элемент не приблизился к вьюпорту — просто не передаём `source`
 * в Image (значит, запрос к сети не уходит). Как только пересечение случилось —
 * передаём настоящий source и снимаем наблюдатель.
 *
 * На native-платформах ведёт себя как обычный Image (там RN сам управляет
 * приоритетами загрузки на уровне ОС).
 */
export function LazyImage(props: ImageProps) {
  const { source, ...rest } = props;
  const [shouldLoad, setShouldLoad] = useState(Platform.OS !== 'web');
  const ref = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || shouldLoad) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            break;
          }
        }
      },
      // Подгружаем чуть заранее, до появления в зоне видимости — без рывков при скролле
      { rootMargin: '600px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad]);

  if (Platform.OS !== 'web' && shouldLoad && ExpoImage) {
    const uri = typeof source === 'object' && !Array.isArray(source) ? (source as any)?.uri : undefined;
    if (uri) {
      return (
        <ExpoImage
          source={{ uri }}
          style={rest.style}
          contentFit={(rest.resizeMode as any) || 'cover'}
          cachePolicy="memory-disk"
          transition={150}
          onError={rest.onError as any}
        />
      );
    }
  }

  return (
    <Image
      ref={ref}
      source={shouldLoad ? source : undefined}
      {...rest}
    />
  );
}

export default LazyImage;
