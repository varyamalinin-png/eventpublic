import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.image, { opacity }]} />
      <View style={styles.body}>
        <Animated.View style={[styles.title, { opacity }]} />
        <Animated.View style={[styles.subtitle, { opacity }]} />
        <View style={styles.row}>
          <Animated.View style={[styles.pill, { opacity }]} />
          <Animated.View style={[styles.pill, { opacity }]} />
          <Animated.View style={[styles.pill, { opacity }]} />
        </View>
      </View>
    </View>
  );
}

export default React.memo(SkeletonCard);

export function SkeletonFeed({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16161a',
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#1c1c20',
  },
  body: {
    padding: 16,
    gap: 10,
  },
  title: {
    height: 18,
    width: '70%',
    backgroundColor: '#1c1c20',
    borderRadius: 8,
  },
  subtitle: {
    height: 14,
    width: '90%',
    backgroundColor: '#1c1c20',
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    height: 28,
    width: 80,
    backgroundColor: '#1c1c20',
    borderRadius: 10,
  },
});
