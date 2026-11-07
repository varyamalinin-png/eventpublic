import React from 'react';
import { Platform, StyleSheet, Text, View, TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Плейсхолдер параметра карточки для гостя (без аккаунта).
 *
 * Рендерит правдоподобный текст под блюром. Настоящее значение гостю не
 * приезжает вообще — его вырезает сервер (server/src/events/guest-sanitize.ts),
 * так что блюр здесь честный: под ним нет данных, которые можно подсмотреть.
 */
export function GuestBlurredValue({ text, style }: { text: string; style?: TextStyle }) {
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[style, { filter: 'blur(4px)', userSelect: 'none' } as any]}
        numberOfLines={1}
      >
        {text}
      </Text>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={[style]} numberOfLines={1}>{text}</Text>
      <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    alignSelf: 'flex-start',
    maxWidth: 120,
  },
});
