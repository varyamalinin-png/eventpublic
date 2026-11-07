import { View, StyleSheet, Dimensions, Animated, Easing, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { Palette } from '../constants/DesignSystem';

const SCREEN_WIDTH = Platform.OS === 'web'
  ? Math.min(Dimensions.get('window').width, 500)
  : Dimensions.get('window').width;

/**
 * Заглушка ленты меморис.
 *
 * Показывается ТОЛЬКО когда постов нет вообще — то есть при первом открытии на
 * этом устройстве. Если лента уже лежит в кэше, она рисуется сразу, и мигать
 * плейсхолдерами поверх готового содержимого не нужно.
 *
 * Пропорции повторяют настоящий пост (шапка с аватаркой, фото 3:4, строка
 * действий), чтобы при подстановке данных ничего не прыгало.
 */
export function MemoryFeedSkeleton({ posts = 2 }: { posts?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View>
      {Array.from({ length: posts }).map((_, index) => (
        <Animated.View key={index} style={[styles.post, { opacity: pulse }]}>
          <View style={styles.header}>
            <View style={styles.avatar} />
            <View style={styles.headerLines}>
              <View style={[styles.line, { width: 120 }]} />
              <View style={[styles.line, { width: 80, marginTop: 6, height: 10 }]} />
            </View>
          </View>
          <View style={styles.photo} />
          <View style={styles.actions}>
            <View style={[styles.line, { width: 60 }]} />
            <View style={[styles.line, { width: 60, marginLeft: 12 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surfaceElevated,
  },
  headerLines: {
    marginLeft: 12,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Palette.surfaceElevated,
  },
  photo: {
    width: SCREEN_WIDTH,
    aspectRatio: 3 / 4,
    backgroundColor: Palette.surfaceElevated,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
