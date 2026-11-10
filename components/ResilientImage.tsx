import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform } from 'react-native';
import type { ImageProps, ImageSourcePropType } from 'react-native';

// Как и LazyImage: на нативных платформах предпочитаем expo-image — у него
// дисковый кеш, который переживает перезапуск приложения.
let ExpoImage: any = null;
if (Platform.OS !== 'web') {
  try { ExpoImage = require('expo-image').Image; } catch {}
}

type ResilientImageProps = Omit<ImageProps, 'source'> & {
  source: ImageSourcePropType;
  /**
   * Запасной адрес той же картинки через другой маршрут (например, серверный
   * ресайз на iwent.ru вместо прямого CDN-бакета). Используется, если основной
   * URL не загрузился даже после повтора.
   */
  fallbackUri?: string;
};

/** Сколько ждать перед повтором той же ссылки после ошибки загрузки. */
const RETRY_DELAY_MS = 1500;

/**
 * Картинка, которая не сдаётся после первой ошибки.
 *
 * На нестабильной сети (мобильный МТС) запрос картинки часто просто зависает
 * и умирает по таймауту, хотя сама сеть жива. Повтор через полторы секунды в
 * такой ситуации почти всегда достаёт файл. Если и повтор не помог, пробуем
 * fallbackUri — тот же файл через другой маршрут: вариант может отсутствовать
 * в CDN-бакете (старые загрузки, окно генерации), и тогда выручает серверный
 * ресайз на лету.
 *
 * Снаружи выглядит как обычный <Image>: все пропсы пробрасываются.
 */
export function ResilientImage({ source, fallbackUri, onError, ...rest }: ResilientImageProps) {
  const primaryUri = typeof source === 'object' && !Array.isArray(source) && source ? source.uri : undefined;
  const [stage, setStage] = useState(0); // 0 — основной URL, 1 — повтор, 2 — fallback, 3 — сдаться
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Родитель передал новую картинку — начинаем последовательность заново.
  useEffect(() => {
    setStage(0);
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [primaryUri, fallbackUri]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  const handleError = useCallback(
    (event: Parameters<NonNullable<ImageProps['onError']>>[0]) => {
      if (stage === 0) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          setStage(1);
        }, RETRY_DELAY_MS);
        return;
      }
      if (stage === 1 && fallbackUri && fallbackUri !== primaryUri) {
        setStage(2);
        return;
      }
      setStage(3);
      onError?.(event);
    },
    [stage, fallbackUri, primaryUri, onError],
  );

  const activeSource: ImageSourcePropType =
    stage === 2 && fallbackUri ? { uri: fallbackUri } : source;

  const activeUri =
    stage === 2 && fallbackUri ? fallbackUri : primaryUri;

  // stage=3: рендерим последний источник как есть — пусть остаётся то, что
  // показала бы обычная Image после ошибки (плейсхолдер/фон родителя).
  // key заставляет заново начать загрузку при смене стадии: иначе после
  // onError картинка считается «умершей» и повтор по тому же uri не идёт.
  const reloadKey = `${stage}:${activeUri ?? ''}`;

  if (ExpoImage && activeUri) {
    return (
      <ExpoImage
        key={reloadKey}
        source={{ uri: activeUri }}
        style={rest.style}
        contentFit={(rest.resizeMode as any) || 'cover'}
        cachePolicy="memory-disk"
        transition={150}
        onError={handleError}
      />
    );
  }

  return <Image key={reloadKey} source={activeSource} onError={handleError} {...rest} />;
}

export default ResilientImage;
