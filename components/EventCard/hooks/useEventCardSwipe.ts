import { useRef, useState } from 'react';
import { Animated } from 'react-native';

export const useEventCardSwipe = () => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [showSwipeButtons, setShowSwipeButtons] = useState(false);
  const swipeX = useRef(0);

  const resetSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    setShowSwipeButtons(false);
    swipeX.current = 0;
  };

  return {
    translateX,
    showSwipeButtons,
    setShowSwipeButtons,
    swipeX,
    resetSwipe,
  };
};

