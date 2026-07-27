import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { Event } from '../../types/Event';

export type EventAction = {
  id: string;
  label: string;
  isClickable?: boolean;
};

type UseEventCardActionsParams = {
  event: Event | undefined;
  context: 'explore' | 'memories' | 'other_profile' | 'own_profile' | 'folder';
  relationship: 'organizer' | 'accepted' | 'waiting' | 'invited' | 'non_member' | 'rejected';
  isPast: boolean;
  participantsCount: number;
  isEventSaved: (eventId: string) => boolean;
  eventId: string;
  tagsVisible: boolean;
  hasEventFolders: boolean;
  folderId?: string;
};

export function useEventCardActions({
  event,
  context,
  relationship,
  isPast,
  participantsCount,
  isEventSaved,
  eventId,
  tagsVisible,
  hasEventFolders,
  folderId,
}: UseEventCardActionsParams): EventAction[] {
  const { t } = useLanguage();

  const getSaveButtonLabel = () => {
    return isEventSaved(eventId) ? t.events.removeFromSaved : t.events.save;
  };

  return useMemo(() => {
    if (!event) return [];

    const actions: EventAction[] = [];

    // ЛЕНТЫ EXPLORE (GLOB/FRIENDS)
    if (context === 'explore') {
      if (isPast) {
        // Для прошедших событий показываем минимальный набор действий
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        return actions;
      }

      // Предстоящее время
      if (relationship === 'invited') {
        actions.push({ id: 'accept_invite', label: t.events.acceptInvitation, isClickable: true });
        actions.push({ id: 'cancel_invite', label: t.events.cancelInvitation, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      } else if (relationship === 'waiting') {
        actions.push({ id: 'view_requests', label: t.events.viewRequests, isClickable: true });
        actions.push({ id: 'cancel_request', label: t.events.cancelRequest, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      } else if (relationship === 'accepted') {
        // Кнопка "Перейти в чат" - активна только если участников >= 2
        if (participantsCount >= 2) {
          actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
        }
      } else if (relationship === 'organizer') {
        actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
        actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
        // Всегда показываем кнопку "отменить событие", попап с transfer organizer role покажется при нажатии
        actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
        if (event.isRecurring) {
          actions.push({ id: 'extend_recurring', label: t.events.extendRecurring || t.events.extendRecurring, isClickable: true });
        }
        // Кнопка "Перейти в чат" - активна только если участников >= 2
        if (participantsCount >= 2) {
          actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      } else if (relationship === 'non_member') {
        actions.push({ id: 'schedule', label: t.events.schedule, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      } else if (relationship === 'rejected') {
        return [];
      }
    }

    // ПРОФИЛЬ ДРУГОГО ЧЕЛОВЕКА
    else if (context === 'other_profile') {
      if (isPast) {
        if (relationship === 'accepted') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'change_photo', label: t.events.changePhoto, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else {
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
      } else {
        if (relationship === 'invited') {
          actions.push({ id: 'accept_invite', label: t.events.acceptInvitation, isClickable: true });
          actions.push({ id: 'cancel_invite', label: t.events.cancelInvitation, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'waiting') {
          actions.push({ id: 'view_requests', label: t.events.viewRequests, isClickable: true });
          actions.push({ id: 'cancel_request', label: t.events.cancelRequest, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'accepted') {
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
          // Кнопка "Перейти в чат" - активна только если участников >= 2
          if (participantsCount >= 2) {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
          } else {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
          }
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
          if (participantsCount === 1) {
            actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
          } else {
            actions.push({ id: 'transfer_organizer_role', label: t.events.transferOrganizerRole || t.events.transferOrganizerRole, isClickable: true });
          }
          actions.push({ id: 'remove_participant', label: t.events.removeParticipant, isClickable: true });
          // Кнопка "Перейти в чат" - активна только если участников >= 2
          if (participantsCount >= 2) {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
          } else {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
          }
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else if (relationship === 'non_member') {
          actions.push({ id: 'schedule', label: t.events.schedule });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'rejected') {
          return [];
        }
      }
    }

    // МОЙ ПРОФИЛЬ
    else if (context === 'own_profile') {
      if (isPast) {
        if (relationship === 'accepted') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || t.common.delete, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || t.common.delete, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
      } else {
        if (relationship === 'accepted') {
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          // Кнопка "Перейти в чат" - активна только если участников >= 2
          if (participantsCount >= 2) {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
          } else {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
          }
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
          if (participantsCount === 1) {
            actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
          } else {
            actions.push({ id: 'transfer_organizer_role', label: t.events.transferOrganizerRole || t.events.transferOrganizerRole, isClickable: true });
          }
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
          // Кнопка "Перейти в чат" - активна только если участников >= 2
          if (participantsCount >= 2) {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: true });
          } else {
            actions.push({ id: 'go_to_chat', label: t.events.goToChat || t.events.goToChat, isClickable: false });
          }
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
      }
    }

    // РАЗДЕЛ MEMORIES (прошедшие события)
    else if (context === 'memories') {
      if (isPast) {
        actions.push({
          id: 'toggle_tags',
          label: tagsVisible ? (t.events.hideTags || t.events.hideTags) : (t.events.showTags || t.events.showTags),
          isClickable: true
        });
        if (hasEventFolders) {
          actions.push({
            id: 'add_to_folder',
            label: t.events.addToFolder,
            isClickable: true
          });
        }
        if (relationship === 'organizer' || relationship === 'accepted') {
          actions.push({
            id: 'delete_event',
            label: t.events.deleteEvent || t.common.delete,
            isClickable: true
          });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
    }

    // РАЗДЕЛ FOLDER (событие внутри папки)
    else if (context === 'folder') {
      if (isPast && folderId) {
        actions.push({
          id: 'remove_from_folder',
          label: t.events.removeFromFolder,
          isClickable: true
        });
        actions.push({
          id: 'toggle_tags',
          label: tagsVisible ? (t.events.hideTags || t.events.hideTags) : (t.events.showTags || t.events.showTags),
          isClickable: true
        });
        if (relationship === 'organizer' || relationship === 'accepted') {
          actions.push({
            id: 'delete_event',
            label: t.events.deleteEvent || t.common.delete,
            isClickable: true
          });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
    }

    return actions;
  }, [
    event,
    context,
    relationship,
    isPast,
    participantsCount,
    isEventSaved,
    eventId,
    tagsVisible,
    hasEventFolders,
    folderId,
    t,
    getSaveButtonLabel,
  ]);
}

