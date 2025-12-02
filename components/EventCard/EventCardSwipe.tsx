import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import type { SwipeButtons } from './utils/getSwipeButtons';

interface EventCardSwipeProps {
  swipeButtons: SwipeButtons;
  translateX: Animated.Value;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
}

export default function EventCardSwipe({
  swipeButtons,
  translateX,
  onPrimaryPress,
  onSecondaryPress,
}: EventCardSwipeProps) {
  if (!swipeButtons.primary && !swipeButtons.secondary) {
    return null;
  }

  return (
    <View style={styles.swipeButtonsContainer}>
      {swipeButtons.secondary && (
        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: swipeButtons.secondary.color }]}
          onPress={onSecondaryPress}
        >
          <Text style={styles.swipeButtonIcon}>{swipeButtons.secondary.icon}</Text>
          <Text style={styles.swipeButtonLabel}>{swipeButtons.secondary.label}</Text>
        </TouchableOpacity>
      )}
      
      {swipeButtons.primary && (
        <TouchableOpacity
          style={[styles.swipeButton, { backgroundColor: swipeButtons.primary.color }]}
          onPress={onPrimaryPress}
        >
          <Text style={styles.swipeButtonIcon}>{swipeButtons.primary.icon}</Text>
          <Text style={styles.swipeButtonLabel}>{swipeButtons.primary.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  swipeButtonsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 10,
  },
  swipeButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  swipeButtonIcon: {
    color: '#FFF',
    fontSize: 20,
    marginBottom: 5,
  },
  swipeButtonLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

