// Заглушка для @expo/vector-icons
import React from 'react';
import { Text } from 'react-native';

// Создаем простые заглушки для иконок
const createIconStub = (name) => {
  return React.forwardRef((props, ref) => {
    return <Text ref={ref} {...props}>{name}</Text>;
  });
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

