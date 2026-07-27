import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

function OfflineBanner() {
  const { t } = useLanguage();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handle = () => setIsOffline(!navigator.onLine);
      window.addEventListener('online', () => setIsOffline(false));
      window.addEventListener('offline', () => setIsOffline(true));
      setIsOffline(!navigator.onLine);
      return () => {
        window.removeEventListener('online', () => setIsOffline(false));
        window.removeEventListener('offline', () => setIsOffline(true));
      };
    }
    // Native: use NetInfo if available
    let unsubscribe: (() => void) | undefined;
    try {
      const NetInfo = require('@react-native-community/netinfo');
      unsubscribe = NetInfo.addEventListener((state: any) => {
        setIsOffline(!state.isConnected);
      });
    } catch {
      // NetInfo not installed — skip
    }
    return () => unsubscribe?.();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t.common.noConnection}</Text>
    </View>
  );
}

export default React.memo(OfflineBanner);

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF3B30',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
});
