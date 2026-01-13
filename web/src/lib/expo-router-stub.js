// Заглушка для expo-router в Next.js
const React = require('react');

// Безопасный импорт Next.js модулей с обработкой ошибок
let nextUseRouter, usePathname, useParams, useSearchParams, nextRedirect, NextLink;

try {
  const nextNavigation = require('next/navigation');
  nextUseRouter = nextNavigation.useRouter;
  usePathname = nextNavigation.usePathname;
  useParams = nextNavigation.useParams;
  useSearchParams = nextNavigation.useSearchParams;
  nextRedirect = nextNavigation.redirect;
  NextLink = require('next/link').default;
} catch (error) {
  console.warn('[expo-router-stub] Failed to load next/navigation, using fallbacks:', error);
  // Fallback функции
  nextUseRouter = () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
  });
  usePathname = () => '/';
  useParams = () => ({});
  useSearchParams = () => ({
    get: () => null,
    forEach: () => {},
  });
  nextRedirect = () => {};
  NextLink = function NextLink({ href, children, ...props }) {
    return React.createElement('a', { href, ...props }, children);
  };
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

export const useRouter = () => {
  try {
    const router = nextUseRouter();
    if (!router) {
      throw new Error('Router not initialized');
    }
    
    // Функция для установки параметров через query string
    const setParams = (params) => {
      try {
        if (typeof window === 'undefined') return;
        
        const url = new URL(window.location.href);
        Object.keys(params).forEach(key => {
          if (params[key] === undefined || params[key] === null) {
            url.searchParams.delete(key);
          } else {
            url.searchParams.set(key, String(params[key]));
          }
        });
        
        // Обновляем URL без перезагрузки страницы
        window.history.replaceState({}, '', url.toString());
        
        // Вызываем событие для обновления компонентов, которые используют query параметры
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch (error) {
        console.warn('[expo-router-stub] Error in router.setParams:', error);
      }
    };
    
    return {
      push: (href) => {
        try {
          const nextHref = convertHref(href);
          if (router.push) {
            router.push(nextHref);
          }
        } catch (error) {
          console.warn('[expo-router-stub] Error in router.push:', error);
          if (typeof window !== 'undefined') {
            window.location.href = convertHref(href);
          }
        }
      },
      replace: (href) => {
        try {
          const nextHref = convertHref(href);
          if (router.replace) {
            router.replace(nextHref);
          }
        } catch (error) {
          console.warn('[expo-router-stub] Error in router.replace:', error);
          if (typeof window !== 'undefined') {
            window.location.replace(convertHref(href));
          }
        }
      },
      back: () => {
        try {
          if (router.back) {
            router.back();
          } else if (typeof window !== 'undefined') {
            window.history.back();
          }
        } catch (error) {
          console.warn('[expo-router-stub] Error in router.back:', error);
          if (typeof window !== 'undefined') {
            window.history.back();
          }
        }
      },
      setParams: setParams,
      canGoBack: () => {
        if (typeof window !== 'undefined') {
          return window.history.length > 1;
        }
        return false;
      },
    };
  } catch (error) {
    console.warn('[expo-router-stub] Error initializing router, using fallback:', error);
    // Fallback router
    return {
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
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      },
      setParams: (params) => {
        // Заглушка для setParams - не поддерживается в Next.js напрямую
        console.warn('[expo-router-stub] setParams is not supported in Next.js fallback');
      },
      canGoBack: () => false,
    };
  }
};

export const useLocalSearchParams = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const result = { ...params };
  
  // Добавляем query параметры
  searchParams.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
};

export const useFocusEffect = (callback) => {
  React.useEffect(() => {
    callback();
  }, []);
};

export const Redirect = ({ href }) => {
  const nextHref = convertHref(href);
  nextRedirect(nextHref);
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
  
  return React.createElement(NextLink, { href: nextHref, ref, ...props }, children);
});
Link.displayName = 'Link';

export const Stack = ({ children }) => children;
export const Tabs = ({ children }) => children;
export default {};

