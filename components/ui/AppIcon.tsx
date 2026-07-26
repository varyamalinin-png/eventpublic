import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Palette } from '../../constants/DesignSystem';

/**
 * Единый набор иконок iWent поверх Feather (тонкие line-иконки, без эмодзи).
 * Имена — семантические, чтобы можно было сменить нижележащий набор иконок не трогая код экранов.
 */
const ICONS = {
  search: 'search',
  calendar: 'calendar',
  map: 'map',
  home: 'home',
  bookmark: 'bookmark',
  plus: 'plus',
  inbox: 'inbox',
  user: 'user',
  heart: 'heart',
  message: 'message-circle',
  settings: 'settings',
  bell: 'bell',
  filter: 'sliders',
  chevronLeft: 'chevron-left',
  chevronRight: 'chevron-right',
  close: 'x',
  check: 'check',
  share: 'share-2',
  more: 'more-horizontal',
  pin: 'map-pin',
  clock: 'clock',
  ticket: 'tag',
  users: 'users',
  folder: 'folder',
  camera: 'camera',
  edit: 'edit-2',
  logout: 'log-out',
  shield: 'shield',
  flag: 'flag',
  card: 'credit-card',
  mic: 'mic',
  link: 'link',
  eye: 'eye',
  smartphone: 'smartphone',
  globe: 'globe',
  lock: 'lock',
  help: 'help-circle',
  lock: 'lock',
  mail: 'mail',
  send: 'send',
  trash: 'trash-2',
  globe: 'globe',
  smartphone: 'smartphone',
  help: 'help-circle',
  image: 'image',
  monitor: 'monitor',
  wifi: 'wifi',
  alertTriangle: 'alert-triangle',
  activity: 'activity',
  barChart: 'bar-chart-2',
  trendingUp: 'trending-up',
  layers: 'layers',
  zap: 'zap',
  messageSquare: 'message-square',
  userPlus: 'user-plus',
  userX: 'user-x',
  arrowRight: 'arrow-right',
} as const;

export type AppIconName = keyof typeof ICONS;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 20, color = Palette.text }: AppIconProps) {
  return <Feather name={ICONS[name] as any} size={size} color={color} />;
}
