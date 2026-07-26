// Заглушка для expo-router в Next.js
'use client';

const React = require('react');

// Ленивая загрузка Next.js модулей только при необходимости (на сервере)
let nextUseRouter, usePathname, useParams, useSearchParams, nextRedirect, NextLink;
if (typeof window === 'undefined') {
  // Только на сервере загружаем Next.js хуки
  try {
    const nextNavigation = require('next/navigation');
    nextUseRouter = nextNavigation.useRouter;
    usePathname = nextNavigation.usePathname;
    useParams = nextNavigation.useParams;
    useSearchParams = nextNavigation.useSearchParams;
    nextRedirect = nextNavigation.redirect;
    NextLink = require('next/link').default;
  } catch (e) {
    // Fallback если модули не доступны
  }
}

// Конвертирует expo-router href в Next.js href
function convertHref(href) {
  if (typeof href === 'string') {
    // Удаляем скобки из путей (Expo Router использует (auth), (tabs) для группировки, но они не входят в URL)
    // В Next.js скобки также используются для группировки, но не включаются в URL
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
  // Если href - объект с pathname
  if (href && typeof href === 'object' && href.pathname) {
    return convertHref(href.pathname);
  }
  return href;
}

// Создаем fallback router один раз
const createFallbackRouter = () => ({
  push: (href) => {
    if (typeof window !== 'undefined') {
      window.location.href = convertHref(href);
    }
  },
  replace: (href) => {
    if (typeof window !== 'undefined') {
      window.location.replace(convertHref(href));
    }
  },
  back: () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  },
  setParams: () => {},
  canGoBack: () => {
    return typeof window !== 'undefined' && window.history.length > 1;
  },
});

export const useRouter = () => {
  // На вебе всегда используем fallback router, чтобы избежать проблем с контекстом Next.js
  // Fallback использует window.location, что всегда доступно и работает надежно
  // Это предотвращает React error #321, когда useContext вызывается до готовности Provider
  if (typeof window !== 'undefined') {
    return createFallbackRouter();
  }
  
  // На сервере пытаемся использовать Next.js роутер
  let router = null;
  try {
    router = nextUseRouter();
  } catch (error) {
    return createFallbackRouter();
  }
  
    if (!router || typeof router !== 'object') {
    return createFallbackRouter();
    }
  
  // Если роутер получен успешно и валиден на сервере, используем его методы
    return {
      push: (href) => {
        try {
          const nextHref = convertHref(href);
          if (router && typeof router.push === 'function') {
          router.push(nextHref);
          } else if (typeof window !== 'undefined') {
            window.location.href = nextHref;
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('[expo-router-stub] Error in router.push:', error);
          }
          if (typeof window !== 'undefined') {
            window.location.href = convertHref(href);
          }
        }
      },
      replace: (href) => {
        try {
          const nextHref = convertHref(href);
          if (router && typeof router.replace === 'function') {
          router.replace(nextHref);
          } else if (typeof window !== 'undefined') {
            window.location.replace(nextHref);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('[expo-router-stub] Error in router.replace:', error);
          }
          if (typeof window !== 'undefined') {
            window.location.replace(convertHref(href));
          }
        }
      },
      back: () => {
        try {
          if (router && typeof router.back === 'function') {
          router.back();
          } else if (typeof window !== 'undefined') {
            window.history.back();
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
          console.warn('[expo-router-stub] Error in router.back:', error);
          }
          if (typeof window !== 'undefined') {
            window.history.back();
          }
        }
      },
      setParams: () => {
        // Заглушка для setParams - не поддерживается в Next.js напрямую
      },
      canGoBack: () => {
        try {
          if (router && typeof router.canGoBack === 'function') {
            return router.canGoBack();
        }
          return typeof window !== 'undefined' && window.history.length > 1;
        } catch {
          return false;
        }
      },
    };
};

export const useLocalSearchParams = () => {
  // На вебе получаем параметры из пути и query string
  // Это избегает проблем с контекстом Next.js и React error #321/#130
  if (typeof window !== 'undefined') {
    const result = {};
    
    // Получаем динамические параметры из пути (например, [id] из /event-profile/[id])
    const pathname = window.location.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    
    // Парсим динамические параметры из пути
    // Например: /event-profile/123 -> { id: '123' }
    // Ищем паттерны типа /event-profile/[id] или /event/[id]
    if (pathSegments.length >= 2) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      const secondLastSegment = pathSegments[pathSegments.length - 2];
      
      // Если путь содержит /event-profile/xxx, то id = xxx
      if (secondLastSegment === 'event-profile') {
        result.id = lastSegment;
      }
      // Если путь содержит /event/xxx, то id = xxx
      else if (secondLastSegment === 'event') {
        result.id = lastSegment;
      }
      // Если путь содержит /profile/xxx, то id = xxx
      else if (secondLastSegment === 'profile') {
        result.id = lastSegment;
      }
      // Если путь содержит /memory-post/xxx/yyy, то eventId = xxx, postId = yyy
      else if (pathSegments.length >= 3 && secondLastSegment === 'memory-post') {
        const eventIdIndex = pathSegments.indexOf('memory-post');
        if (eventIdIndex >= 0 && eventIdIndex + 1 < pathSegments.length) {
          result.eventId = pathSegments[eventIdIndex + 1];
          if (eventIdIndex + 2 < pathSegments.length) {
            result.postId = pathSegments[eventIdIndex + 2];
          }
        }
      }
      // Если путь содержит /inbox/xxx, то chatId = xxx
      else if (secondLastSegment === 'inbox') {
        result.chatId = lastSegment;
      }
      // Если путь содержит /friends-list/xxx, то id = xxx
      else if (secondLastSegment === 'friends-list') {
        result.id = lastSegment;
      }
      // Если путь содержит /all-events/xxx, то userId = xxx
      else if (secondLastSegment === 'all-events') {
        result.userId = lastSegment;
      }
      // Если путь содержит /organized-events/xxx, то userId = xxx
      else if (secondLastSegment === 'organized-events') {
        result.userId = lastSegment;
      }
      // Если путь содержит /participated-events/xxx, то userId = xxx
      else if (secondLastSegment === 'participated-events') {
        result.userId = lastSegment;
      }
      // Если путь содержит /shared-events/xxx, то userId = xxx
      else if (secondLastSegment === 'shared-events') {
        result.userId = lastSegment;
      }
    }
    
    // Получаем параметры из query string
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
        result[key] = value;
      });
    
    return result;
  }
  
  // На сервере возвращаем пустой объект
  // Next.js параметры будут доступны через другие механизмы при SSR
  return {};
};

export const useFocusEffect = (callback) => {
  React.useEffect(() => {
    callback();
  }, []);
};

export const Redirect = ({ href }) => {
  const nextHref = convertHref(href);
  if (typeof window === 'undefined' && nextRedirect) {
  nextRedirect(nextHref);
  } else if (typeof window !== 'undefined') {
    window.location.href = nextHref;
  }
  return null;
};

// Link компонент для Next.js
export const Link = React.forwardRef(({ href, asChild, children, ...props }, ref) => {
  const nextHref = convertHref(href);
  
  // Если asChild, то передаем href и ref дочернему элементу
  if (asChild && React.Children.count(children) === 1) {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      ...child.props,
      href: nextHref,
      ref: ref || child.ref,
    });
  }
  
  // На клиенте используем обычный <a> тег, чтобы избежать проблем с NextLink
  if (typeof window !== 'undefined') {
    return React.createElement('a', { href: nextHref, ref, ...props }, children);
  }
  
  // На сервере используем NextLink если доступен
  if (NextLink) {
  return React.createElement(NextLink, { href: nextHref, ref, ...props }, children);
  }
  
  // Fallback
  return React.createElement('a', { href: nextHref, ref, ...props }, children);
});
Link.displayName = 'Link';

export const Stack = ({ children }) => children;
export const Tabs = ({ children }) => children;
export default {};

