// Заглушка для ThemedText компонента
import React from 'react';
import { Text } from 'react-native';

// JSDoc типы вместо TypeScript для совместимости
/**
 * @typedef {Object} ThemedTextProps
 * @property {string} [lightColor]
 * @property {string} [darkColor]
 * @property {'default'|'title'|'defaultSemiBold'|'subtitle'|'link'} [type]
 * @property {any} [style]
 * @property {React.ReactNode} [children]
 */

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  children,
  ...rest
}) {
  const textStyle = [
    type === 'default' && { fontSize: 16, lineHeight: 24 },
    type === 'title' && { fontSize: 32, fontWeight: 'bold', lineHeight: 32 },
    type === 'defaultSemiBold' && { fontSize: 16, lineHeight: 24, fontWeight: '600' },
    type === 'subtitle' && { fontSize: 20, fontWeight: 'bold' },
    type === 'link' && { lineHeight: 30, fontSize: 16, color: '#0a7ea4' },
    style,
  ].filter(Boolean);

  return (
    <Text style={textStyle} {...rest}>
      {children}
    </Text>
  );
}

export default ThemedText;

