// Заглушка для @expo/vector-icons
import React from 'react';
import { Text, View } from 'react-native';

// Тонкие line-иконки (в духе Feather) для веба — рендерим как inline SVG,
// чтобы единый AppIcon (client/components/ui/AppIcon.tsx) выглядел одинаково
// на вебе и в нативном приложении.
const FEATHER_PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5a.5.5 0 0 1-.5-.5V15a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1Z" />,
  bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  inbox: <><path d="M4 12h4l2 3h4l2-3h4" /><path d="M5.5 5h13L21 12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5.5 5Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  heart: <path d="M12 20s-7-4.4-9.3-8.8C1.3 8 3 5 6.3 5c2 0 3.4 1 5.7 3.4C14.3 6 15.7 5 17.7 5 21 5 22.7 8 21.3 11.2 19 15.6 12 20 12 20Z" />,
  'message-circle': <path d="M4 5h16v11H8l-4 4Z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.8-1.6L13.3 2h-2.6l-.4 2.8a7 7 0 0 0-2.8 1.6l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.8 1.6l.4 2.8h2.6l.4-2.8a7 7 0 0 0 2.8-1.6l2.3.9 2-3.4-2-1.5c.13-.5.2-1.05.2-1.6Z" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  sliders: <path d="M4 5h16M7 12h10M10 19h4" />,
  'chevron-left': <path d="M15 5 8 12l7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 13 4 4L19 7" />,
  'share-2': <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />,
  'more-horizontal': <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  'map-pin': <><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  tag: <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.7 1.7 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.7 1.7 0 0 0 0-3V9Z" />,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 12.3c2.6.3 4.5 2 4.5 4.7" /></>,
  folder: <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />,
  camera: <><path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.6" /></>,
  'edit-2': <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />,
  'log-out': <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9" />,
  shield: <><path d="M12 3 5 6v5c0 4.6 3 7.7 7 9 4-1.3 7-4.4 7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
  flag: <path d="M5 21V4M5 5h12l-2.5 3L17 11H5" />,
  'credit-card': <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  send: <path d="m4 12 16-8-6 16-2.5-7L4 12Z" />,
  'trash-2': <path d="M5 7h14M9 7V5h6v2m-9 0 1 13h10l1-13" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></>,
  smartphone: <><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  'help-circle': <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 1.7-2.3 3.5" /><path d="M12 17.5h.01" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2.5" /><path d="M8 21h8M12 17v4" /></>,
};

const FALLBACK_EMOJI = {
  'chevron-forward': '→',
  'arrow-back': '←',
  'person-outline': '👤',
  'add-circle-outline': '➕',
  'calendar-outline': '📅',
};

// Создаем простые заглушки для иконок
const createIconStub = (iconFamilyName) => {
  const IconComponent = React.forwardRef((props, ref) => {
    const { name, size = 24, color = '#000', style, ...otherProps } = props;

    const featherChildren = FEATHER_PATHS[name];
    if (featherChildren) {
      return (
        <View ref={ref} style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]} {...otherProps}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {featherChildren}
          </svg>
        </View>
      );
    }

    const iconSymbol = FALLBACK_EMOJI[name] || '●';
    return (
      <View ref={ref} style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]} {...otherProps}>
        <Text style={{ fontSize: size, color, lineHeight: size }}>{iconSymbol}</Text>
      </View>
    );
  });
  IconComponent.displayName = iconFamilyName;
  return IconComponent;
};

export const Ionicons = createIconStub('Ionicons');
export const FontAwesome = createIconStub('FontAwesome');
export const MaterialIcons = createIconStub('MaterialIcons');
export const AntDesign = createIconStub('AntDesign');
export const Entypo = createIconStub('Entypo');
export const EvilIcons = createIconStub('EvilIcons');
export const Feather = createIconStub('Feather');
export const FontAwesome5 = createIconStub('FontAwesome5');
export const Foundation = createIconStub('Foundation');
export const MaterialCommunityIcons = createIconStub('MaterialCommunityIcons');
export const Octicons = createIconStub('Octicons');
export const SimpleLineIcons = createIconStub('SimpleLineIcons');
export const Zocial = createIconStub('Zocial');

export default {
  Ionicons,
  FontAwesome,
  MaterialIcons,
  AntDesign,
  Entypo,
  EvilIcons,
  Feather,
  FontAwesome5,
  Foundation,
  MaterialCommunityIcons,
  Octicons,
  SimpleLineIcons,
  Zocial,
};
