/**
 * Безопасная обертка для useRouter из expo-router
 * Предотвращает ошибки, когда роутер еще не инициализирован
 */

import React from 'react';
import { useRouter as useExpoRouter } from 'expo-router';
import { Platform } from 'react-native';
import { createLogger } from './logger';

const logger = createLogger('SafeRouter');

/**
 * Конвертирует Expo Router href в Next.js href для веба
 * Удаляет скобки из путей (Expo Router использует (auth), (tabs) для группировки)
 */
function convertHrefForWeb(href: any): string {
  if (typeof href !== 'string') {
    // Если href - объект с pathname
    if (href && typeof href === 'object' && href.pathname) {
      href = href.pathname;
    } else {
      return String(href);
    }
  }
  
  // Удаляем скобки из путей для веба
  let converted = href
    .replace(/\/\([^)]+\)\//g, '/') // Удаляем (group)/ из пути
    .replace(/\/\([^)]+\)$/, '') // Удаляем /(group) в конце
    .replace(/^\([^)]+\)\//, '/'); // Удаляем (group)/ в начале
  
  // Убеждаемся что начинается с /
  if (!converted.startsWith('/')) {
    converted = `/${converted}`;
  }
  
  // Убираем двойные слеши
  converted = converted.replace(/\/+/g, '/');
  
  return converted;
}

/**
 * Безопасный хук для использования роутера
 * Обрабатывает случаи, когда роутер еще не инициализирован
 * Использует React.useMemo для кэширования fallback роутера
 */
export function useSafeRouter() {
  const fallbackRouter = React.useMemo(() => createFallbackRouter(), []);
  
  // КРИТИЧНО: Проверяем router.use ДО вызова useExpoRouter
  // Это предотвращает ошибку "Cannot read property 'use' of null"
  // Используем проверку через глобальный объект роутера, если он доступен
  let router: ReturnType<typeof useExpoRouter> | null = null;
  let hasError = false;
  
  try {
    // Пытаемся получить роутер через try-catch с защитой
    // Важно: вызываем хук ТОЛЬКО внутри try-catch
    router = useExpoRouter();
    
    // Дополнительная защита: проверяем router.use ДО любого доступа к router
    // НО: на мобильных устройствах router.use может быть null во время инициализации,
    // но это не значит, что роутер не работает - просто нужно подождать
    if (router && typeof router === 'object') {
      // Пытаемся безопасно проверить router.use
      try {
        const routerUse = (router as any).use;
        // На мобильных устройствах router.use может быть null во время инициализации
        // Проверяем только на вебе, где это критично
        if (Platform.OS === 'web' && (routerUse === null || routerUse === undefined)) {
          logger.warn('Router.use is null/undefined on web, router not fully initialized, using fallback');
          return fallbackRouter;
        }
        // На мобильных просто игнорируем проверку router.use
      } catch (accessError: any) {
        // Если даже доступ к router.use вызывает ошибку, используем fallback только на вебе
        if (Platform.OS === 'web') {
          logger.warn('Cannot access router.use on web, using fallback:', accessError?.message);
          return fallbackRouter;
        }
        // На мобильных игнорируем ошибку доступа к router.use
      }
    }
    
    // Проверяем, что роутер не null и является объектом
    if (!router || typeof router !== 'object') {
      logger.warn('Router is null or not an object, using fallback');
      return fallbackRouter;
    }
  } catch (error: any) {
    hasError = true;
    const errorMsg = error?.message || String(error);
    // Игнорируем только ошибки, связанные с инициализацией роутера
    if (errorMsg.includes('Cannot read property') && (errorMsg.includes('use') || errorMsg.includes('of null'))) {
      logger.warn('Router initialization error (non-critical), using fallback:', errorMsg);
      return fallbackRouter;
    } else {
      // Для других ошибок тоже используем fallback, но логируем
      logger.warn('Unexpected router error, using fallback:', errorMsg);
      return fallbackRouter;
    }
  }
  
  // Если была ошибка или роутер не валиден, используем fallback
  if (hasError || !router || typeof router !== 'object') {
    return fallbackRouter;
  }
  
  // Проверяем наличие методов роутера
  if (typeof router.push !== 'function') {
    logger.warn('Router.push is not a function, using fallback');
    return fallbackRouter;
  }
  
  return {
    push: (href: any) => {
      try {
        // На вебе используем window.location.href напрямую, но преобразуем путь
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const convertedHref = convertHrefForWeb(href);
          logger.debug('Using window.location.href for web navigation:', { original: href, converted: convertedHref });
          window.location.href = convertedHref;
          return;
        }
        
        if (router && typeof router.push === 'function') {
          router.push(href);
        } else {
          logger.warn('Router.push is not available');
          // Fallback для веба
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const convertedHref = convertHrefForWeb(href);
            window.location.href = convertedHref;
          }
        }
      } catch (error: any) {
        logger.warn('Error in router.push:', error?.message || error);
        // Fallback для веба при ошибке
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const convertedHref = convertHrefForWeb(href);
          window.location.href = convertedHref;
        }
      }
    },
    replace: (href: any) => {
      try {
        // На вебе используем window.location.replace с преобразованием пути
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const convertedHref = convertHrefForWeb(href);
          logger.debug('Using window.location.replace for web navigation:', { original: href, converted: convertedHref });
          window.location.replace(convertedHref);
          return;
        }
        
        if (router && typeof router.replace === 'function') {
          router.replace(href);
        } else {
          logger.warn('Router.replace is not available');
          // Fallback для веба
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const convertedHref = convertHrefForWeb(href);
            window.location.replace(convertedHref);
          }
        }
      } catch (error: any) {
        logger.warn('Error in router.replace:', error?.message || error);
        // Fallback для веба при ошибке
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const convertedHref = convertHrefForWeb(href);
          window.location.replace(convertedHref);
        }
      }
    },
    back: () => {
      try {
        if (router && typeof router.back === 'function') {
          router.back();
        } else {
          logger.warn('Router.back is not available');
        }
      } catch (error: any) {
        logger.warn('Error in router.back:', error?.message || error);
      }
    },
    setParams: (params: any) => {
      try {
        if (router && typeof router.setParams === 'function') {
          router.setParams(params);
        } else {
          logger.warn('Router.setParams is not available');
        }
      } catch (error: any) {
        logger.warn('Error in router.setParams:', error?.message || error);
      }
    },
    canGoBack: () => {
      try {
        if (router && typeof router.canGoBack === 'function') {
          return router.canGoBack();
        }
        return false;
      } catch (error: any) {
        logger.warn('Error in router.canGoBack:', error?.message || error);
        return false;
      }
    },
  };
}

/**
 * Создает fallback роутер, когда настоящий роутер недоступен
 */
function createFallbackRouter() {
  return {
    push: (href: any) => {
      logger.warn('Router.push called but router is not available, href:', href);
      // Fallback для веба с преобразованием пути
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const convertedHref = convertHrefForWeb(href);
        window.location.href = convertedHref;
      }
    },
    replace: (href: any) => {
      logger.warn('Router.replace called but router is not available, href:', href);
      // Fallback для веба с преобразованием пути
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const convertedHref = convertHrefForWeb(href);
        window.location.replace(convertedHref);
      }
    },
    back: () => {
      logger.warn('Router.back called but router is not available');
      // Fallback для веба
      if (typeof window !== 'undefined' && window.history) {
        window.history.back();
      }
    },
    setParams: () => {
      logger.warn('Router.setParams called but router is not available');
    },
    canGoBack: () => false,
  };
}

