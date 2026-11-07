// На вебе экраны рендерятся напрямую из страниц Next.js, навигатора React
// Navigation в дереве нет. Его хуки ищут контекст навигатора и бросают
// «Couldn't find a route object» — из-за этого падали /create, /inbox,
// /inbox/messages и /inbox/requests (единственный импорт оттуда —
// useScrollToTop, который на вебе не нужен: страница и так начинается сверху).
import React from 'react';

export const useScrollToTop = () => {};

export const useIsFocused = () => true;

export const useFocusEffect = (callback) => {
  React.useEffect(() => {
    const cleanup = callback();
    return typeof cleanup === 'function' ? cleanup : undefined;
    // Колбэк у всех вызывающих обёрнут в useCallback, поэтому зависимость от
    // него безопасна и нужна: при первом монтировании сессии ещё нет.
  }, [callback]);
};

export const useNavigation = () => ({
  addListener: () => () => {},
  isFocused: () => true,
  getParent: () => null,
  navigate: () => {},
  goBack: () => {},
  setOptions: () => {},
});

export const useRoute = () => ({ key: 'web', name: 'web', params: {} });

export const useNavigationState = (selector) =>
  typeof selector === 'function' ? selector({ routes: [], index: 0 }) : undefined;

export default {
  useScrollToTop,
  useIsFocused,
  useFocusEffect,
  useNavigation,
  useRoute,
  useNavigationState,
};
