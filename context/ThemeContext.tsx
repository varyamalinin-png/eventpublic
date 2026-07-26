import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  danger: string;
  line: string;
  card: string;
}

const DARK: ThemeColors = {
  background: '#0a0a0c',
  surface: '#141417',
  surfaceHover: '#1c1c20',
  text: '#f4f4f5',
  textDim: 'rgba(244,244,245,0.55)',
  textFaint: 'rgba(244,244,245,0.35)',
  accent: '#FF8D32',
  danger: '#FF453A',
  line: 'rgba(255,255,255,0.07)',
  card: '#16161a',
};

const LIGHT: ThemeColors = {
  background: '#f5f5f7',
  surface: '#ffffff',
  surfaceHover: '#f0f0f2',
  text: '#1a1a1e',
  textDim: 'rgba(26,26,30,0.6)',
  textFaint: 'rgba(26,26,30,0.35)',
  accent: '#FF8D32',
  danger: '#FF3B30',
  line: 'rgba(0,0,0,0.08)',
  card: '#ffffff',
};

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  setMode: () => {},
  colors: DARK,
  isDark: true,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        setModeState(saved);
      }
    }).catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem('app_theme', m).catch(() => {});
  };

  const isDark = mode === 'dark' || (mode === 'auto' && systemScheme !== 'light');
  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
