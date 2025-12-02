import type { Event } from '../../../types';
import { isEventPast } from '../../../utils/eventHelpers';

export interface SwipeButton {
  type: string;
  label: string;
  color: string;
  icon: string;
}

export interface SwipeButtons {
  primary: SwipeButton | null;
  secondary: SwipeButton | null;
}

// Re-export для использования в EventCardSwipe
export type { SwipeButton, SwipeButtons };

export const getSwipeButtons = (
  event: Event | undefined,
  context: 'explore' | 'other_profile' | 'own_profile',
  isOrganizer: boolean,
  isMember: boolean,
  isInvited: boolean,
  participantsCount: number,
  shouldShowSwipeButtons: boolean
): SwipeButtons => {
  // Если событие прошедшее - не показываем кнопки
  if (!shouldShowSwipeButtons || !event || isEventPast(event)) {
    return { primary: null, secondary: null };
  }

  // Для организатора
  if (isOrganizer) {
    if (context === 'explore') {
      if (participantsCount <= 2) {
        return {
          primary: {
            type: 'cancel_event',
            label: 'Отменить событие',
            color: '#FF3B30',
            icon: '✕'
          },
          secondary: null
        };
      } else {
        return {
          primary: {
            type: 'cancel_organizer_participation',
            label: 'Отменить участие',
            color: '#FF3B30',
            icon: '✕'
          },
          secondary: null
        };
      }
    }
    // ... остальная логика
  }

  // Для участника
  if (isMember && !isOrganizer) {
    // ... логика для участника
  }

  // Для приглашенного
  if (isInvited) {
    // ... логика для приглашенного
  }

  // Для не-члена
  return {
    primary: {
      type: 'go',
      label: 'GO',
      color: '#8B5CF6',
      icon: '→'
    },
    secondary: null
  };
};

