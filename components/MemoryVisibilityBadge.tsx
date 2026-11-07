import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppIcon } from './ui/AppIcon';

type Props = {
  /** 'only_me' — замок, 'friends' — две фигурки. */
  kind: 'friends' | 'only_me';
};

/**
 * Значок личной видимости прошедшего события — левый нижний угол мини-карточки.
 *
 * Виден только владельцу профиля: настройка личная, и посторонним знать о ней
 * незачем (сервер им её и не отдаёт — см. EventsService.getMemoryVisibility).
 */
/**
 * Значок по настройке видимости САМОГО события (её задают при создании).
 *
 * Это другая настройка, чем личная видимость воспоминания, но для человека
 * состояние одно и то же — «видно только мне» / «видно друзьям», — поэтому и
 * значок один и тот же.
 */
export function eventVisibilityBadgeKind(event: any): Props['kind'] | undefined {
  const type = event?.visibility?.type;
  if (type === 'only_me') return 'only_me';
  if (type === 'friends') return 'friends';
  return undefined;
}

export default function MemoryVisibilityBadge({ kind }: Props) {
  return (
    <View style={styles.badge} pointerEvents="none">
      <AppIcon name={kind === 'only_me' ? 'lock' : 'users'} size={11} color="#f4f4f5" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
