import { View, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Palette } from '../constants/DesignSystem';

/**
 * Заглушка строки списка друзей.
 *
 * Показывается только когда данных нет ВООБЩЕ (первое открытие на этом
 * устройстве). Если список уже открывали, он рисуется из кэша, и скелетон не
 * нужен — мигать плейсхолдерами поверх готовых данных хуже, чем ничего.
 */
export function FriendRowSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.row, { opacity: pulse }]}>
      <View style={styles.avatar} />
      <View style={styles.lines}>
        <View style={[styles.line, { width: '45%' }]} />
        <View style={[styles.line, { width: '30%', marginTop: 8 }]} />
      </View>
    </Animated.View>
  );
}

export function FriendListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, index) => (
        <FriendRowSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Palette.surfaceElevated,
  },
  lines: {
    flex: 1,
    marginLeft: 12,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Palette.surfaceElevated,
  },
});
