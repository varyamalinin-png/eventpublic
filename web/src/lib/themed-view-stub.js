// Заглушка для ThemedView компонента
import React from 'react';
import { View } from 'react-native';

export function ThemedView({ style, lightColor, darkColor, children, ...otherProps }) {
  return <View style={[{ backgroundColor: '#fff' }, style]} {...otherProps}>{children}</View>;
}

export default ThemedView;

