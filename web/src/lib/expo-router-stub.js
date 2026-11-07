// Заглушка для expo-router в Next.js
'use client';

const React = require('react');

// Next.js navigation — на сервере загружаем сразу, на клиенте лениво (для useLocalSearchParams)
let nextUseRouter, nextUsePathname, useParams, useSearchParams, nextRedirect, NextLink;
function ensureNextNavigation() {
  if (useParams) return;
  try {
    const nextNavigation = require('next/navigation');
    nextUseRouter = nextNavigation.useRouter;
    nextUsePathname = nextNavigation.usePathname;
    useParams = nextNavigation.useParams;
    useSearchParams = nextNavigation.useSearchParams;
    nextRedirect = nextNavigation.redirect;
    NextLink = require('next/link').default;
  } catch (e) {
    // Fallback если модули не доступны
  }
}
if (typeof window === 'undefined') {
  ensureNextNavigation();
}

// Конвертирует expo-router href в Next.js href (сохраняем search и hash для /map?eventId=... и т.д.)
function convertHref(href) {
  if (typeof href === 'string') {
    const [pathPart, ...rest] = href.split('?');
    const searchHash = rest.length ? '?' + rest.join('?') : '';
    let path = pathPart
      .replace(/\/\([^)]+\)\//g, '/')
      .replace(/\/\([^)]+\)$/, '')
      .replace(/^\([^)]+\)\//, '/');
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/\/+/g, '/');
    return path + searchHash;
  }
  if (href && typeof href === 'object' && href.pathname) {
    const path = convertHref(href.pathname);
    const search = href.search || (href.query && '?' + new URLSearchParams(href.query).toString()) || '';
    return path + search;
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
  if (typeof window !== 'undefined') {
    return createFallbackRouter();
  }
  // На сервере — подгружаем Next.js и используем его роутер
  ensureNextNavigation();
  let router = null;
  try {
    router = nextUseRouter && nextUseRouter();
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

// Извлекает параметры динамических сегментов из pathname (для веба, где useParams может быть недоступен)
function getPathParamsFromPathname(pathname) {
  const params = {};
  if (!pathname || typeof pathname !== 'string') return params;
  const path = pathname.replace(/\/$/, '') || '/';
  // event-profile/[id], event/[id]
  const eventProfileMatch = path.match(/^\/event-profile\/([^/]+)$/);
  if (eventProfileMatch) {
    params.id = eventProfileMatch[1];
    return params;
  }
  const eventMatch = path.match(/^\/event\/([^/]+)$/);
  if (eventMatch) {
    params.id = eventMatch[1];
    return params;
  }
  // profile/[id], friends-list/[id]
  const profileMatch = path.match(/^\/profile\/([^/]+)$/);
  if (profileMatch) {
    params.id = profileMatch[1];
    return params;
  }
  const friendsListMatch = path.match(/^\/friends-list\/([^/]+)$/);
  if (friendsListMatch) {
    params.id = friendsListMatch[1];
    return params;
  }
  // inbox/[chatId]
  const inboxMatch = path.match(/^\/inbox\/([^/]+)$/);
  if (inboxMatch) {
    params.chatId = inboxMatch[1];
    return params;
  }
  // memory-post/[eventId]/[postId]
  const memoryPostMatch = path.match(/^\/memory-post\/([^/]+)\/([^/]+)$/);
  if (memoryPostMatch) {
    params.eventId = memoryPostMatch[1];
    params.postId = memoryPostMatch[2];
    return params;
  }
  // all-events/[userId], organized-events/[userId], participated-events/[userId], shared-events/[userId]
  const userIdMatch = path.match(/^\/(all-events|organized-events|participated-events|shared-events)\/([^/]+)$/);
  if (userIdMatch) {
    params.userId = userIdMatch[2];
    return params;
  }
  // event-folder/[id]
  const eventFolderMatch = path.match(/^\/event-folder\/([^/]+)$/);
  if (eventFolderMatch) {
    params.id = eventFolderMatch[1];
    return params;
  }
  return params;
}

// MiniTabBar.tsx / (tabs)/create.tsx read this to know the current path —
// this stub previously didn't export it at all, so calling usePathname()
// threw "is not a function" and crashed the whole page (React error boundary
// -> "Application error") on any screen that renders MiniTabBar on web.
export const usePathname = () => {
  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }
  ensureNextNavigation();
  try {
    return typeof nextUsePathname === 'function' ? nextUsePathname() : '';
  } catch (_) {
    return '';
  }
};

export const useLocalSearchParams = () => {
  // На клиенте: query-параметры + параметры из pathname (динамические сегменты)
  // Без pathname в вебе id на /event-profile/[id] пустой — профили событий не загружаются
  if (typeof window !== 'undefined') {
    const result = {};
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
      result[key] = value;
    });
    const pathParams = getPathParamsFromPathname(window.location.pathname);
    Object.assign(result, pathParams);
    return result;
  }
  // На сервере — Next.js useParams (для SSR)
  try {
    ensureNextNavigation();
    if (typeof useParams === 'function') {
      const nextParams = useParams();
      if (nextParams && typeof nextParams === 'object') return nextParams;
    }
  } catch (_) {}
  return {};
};

// Заглушка для useNavigation — на вебе нет нативного 'tabPress' события таб-бара,
// поэтому addListener просто ничего не делает (colбэк никогда не вызывается),
// а не бросает ошибку "is not a function", как было до появления этого экспорта.
export const useNavigation = () => ({
  addListener: () => () => {},
  isFocused: () => true,
  // Родительского навигатора на вебе тоже нет; без этого метода падал /profile.
  getParent: () => null,
});

// На вебе экран не «получает фокус» — он просто смонтирован. Но выполнять
// колбэк ровно один раз при монтировании нельзя: в этот момент сессия из
// localStorage ещё не прочитана, и экран, который грузит данные отсюда
// (воспоминания), оставался пустым навсегда при заходе по прямой ссылке.
// Все вызывающие оборачивают колбэк в useCallback, поэтому реагируем на его
// смену — так же, как это делает настоящий useFocusEffect.
export const useFocusEffect = (callback) => {
  React.useEffect(() => {
    const cleanup = callback();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [callback]);
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

// No-op component; Stack.Screen is used by some screens (e.g. +not-found) — must be a valid component to avoid React #130
const StackScreen = () => null;
StackScreen.displayName = 'Stack.Screen';

export const Stack = Object.assign(({ children }) => children, { Screen: StackScreen });
export const Tabs = ({ children }) => children;
export default {};
