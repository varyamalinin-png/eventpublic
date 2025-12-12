// Заглушка для expo-router в Next.js
const React = require('react');
const { useRouter: nextUseRouter, usePathname, useParams } = require('next/navigation');
const { useSearchParams } = require('next/navigation');
const { redirect: nextRedirect } = require('next/navigation');
const NextLink = require('next/link').default;

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
  const router = nextUseRouter();
  return {
    push: (href) => {
      const nextHref = convertHref(href);
      router.push(nextHref);
    },
    replace: (href) => {
      const nextHref = convertHref(href);
      router.replace(nextHref);
    },
    back: () => router.back(),
  };
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

