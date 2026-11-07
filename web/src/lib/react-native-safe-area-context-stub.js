// На вебе безопасных зон в нативном смысле нет, а без <SafeAreaProvider> в
// дереве useSafeAreaInsets бросает «No safe area value available» — на этом
// падал /inbox/messages. Отступы у браузера задаёт вёрстка, поэтому нули.
import React from 'react';
import { View } from 'react-native';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const ZERO_FRAME = { x: 0, y: 0, width: 0, height: 0 };

export const useSafeAreaInsets = () => ZERO_INSETS;
export const useSafeAreaFrame = () => ZERO_FRAME;
export const initialWindowMetrics = { insets: ZERO_INSETS, frame: ZERO_FRAME };

export const SafeAreaProvider = ({ children }) => <>{children}</>;
export const SafeAreaView = ({ children, style, ...rest }) => (
  <View style={style} {...rest}>
    {children}
  </View>
);
export const SafeAreaInsetsContext = React.createContext(ZERO_INSETS);

export default {
  useSafeAreaInsets,
  useSafeAreaFrame,
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext,
};
