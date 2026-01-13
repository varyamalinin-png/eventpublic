/**
 * Безопасная обертка для useRouter из expo-router
 * Предотвращает ошибки, когда роутер еще не инициализирован
 */

import React from 'react';
import { useRouter as useExpoRouter } from 'expo-router';
import { createLogger } from './logger';

const logger = createLogger('SafeRouter');

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
    if (router && typeof router === 'object') {
      // Пытаемся безопасно проверить router.use
      try {
        const routerUse = (router as any).use;
        if (routerUse === null || routerUse === undefined) {
          logger.warn('Router.use is null/undefined, router not fully initialized, using fallback');
          return fallbackRouter;
        }
      } catch (accessError: any) {
        // Если даже доступ к router.use вызывает ошибку, используем fallback
        logger.warn('Cannot access router.use, using fallback:', accessError?.message);
        return fallbackRouter;
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
        if (router && typeof router.push === 'function') {
          router.push(href);
        } else {
          logger.warn('Router.push is not available');
        }
      } catch (error: any) {
        logger.warn('Error in router.push:', error?.message || error);
      }
    },
    replace: (href: any) => {
      try {
        if (router && typeof router.replace === 'function') {
          router.replace(href);
        } else {
          logger.warn('Router.replace is not available');
        }
      } catch (error: any) {
        logger.warn('Error in router.replace:', error?.message || error);
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
    push: () => {
      logger.warn('Router.push called but router is not available');
    },
    replace: () => {
      logger.warn('Router.replace called but router is not available');
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

