/**
 * Единые токены дизайн-системы iWent (минималистичный стиль, единый акцент).
 * Использовать вместо разрозненных хардкод-значений по компонентам.
 */

export const Palette = {
  background: '#0a0a0c',
  surface: '#141417',
  surfaceElevated: '#1c1c20',
  line: 'rgba(255,255,255,0.07)',
  lineStrong: 'rgba(255,255,255,0.14)',

  text: '#f4f4f5',
  textDim: 'rgba(244,244,245,0.55)',
  textFaint: 'rgba(244,244,245,0.32)',

  accent: '#FF8D32',
  accentSoft: 'rgba(255,141,50,0.14)',

  danger: '#FF3B30',
  dangerSoft: 'rgba(255,59,48,0.12)',
  success: '#34C759',
  warning: '#EF9F27',
  info: '#378ADD',
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const Spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const Typography = {
  title: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: Palette.textDim, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1, textTransform: 'uppercase' as const, color: Palette.textFaint, lineHeight: 16 },
};
