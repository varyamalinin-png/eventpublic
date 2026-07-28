import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon } from './ui/AppIcon';

const { width } = Dimensions.get('window');


interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {

  const { t } = useLanguage();

  // Слайды зависят от языка — считаем внутри компонента
  const SLIDES = [
    {
      icon: 'calendar' as const,
      title: t.onboarding.createEventsTitle,
      subtitle: t.onboarding.createEventsBody,
    },
    {
      icon: 'users' as const,
      title: t.onboarding.inviteFriendsTitle,
      subtitle: t.onboarding.inviteFriendsBody,
    },
    {
      icon: 'image' as const,
      title: t.onboarding.saveMemoriesTitle,
      subtitle: t.onboarding.saveMemoriesBody,
    },
  ];
  const [step, setStep] = useState(0);

  const handleNext = async () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      await AsyncStorage.setItem('onboarding_done', '1');
      onDone();
    }
  };

  const slide = SLIDES[step];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <AppIcon name={slide.icon} size={48} color="#FF8D32" />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.buttonText}>
          {step < SLIDES.length - 1 ? t.onboarding.next : t.common.done}
        </Text>
      </TouchableOpacity>

      {step < SLIDES.length - 1 && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={async () => {
            await AsyncStorage.setItem('onboarding_done', '1');
            onDone();
          }}
        >
          <Text style={styles.skipText}>{t.common.skip}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  content: {
    alignItems: 'center',
    marginBottom: 60,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(255,141,50,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f4f4f5',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#FF8D32',
    width: 24,
  },
  button: {
    backgroundColor: '#FF8D32',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a0d00',
    fontSize: 17,
    fontWeight: '700',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
  },
  skipText: {
    color: 'rgba(244,244,245,0.4)',
    fontSize: 14,
  },
});
