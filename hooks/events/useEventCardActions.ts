import { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { Event } from '../../types/Event';
import { SHOW_IN_DEVELOPMENT_ITEMS } from '../../constants/featureFlags';

export type EventAction = {
  id: string;
  label: string;
  isClickable?: boolean;
  /** Пункт виден и нажимается, но функции ещё нет: в модалке рядом стоит
   *  бейдж «В разработке», а по нажатию показывается подсказка. */
  inDevelopment?: boolean;
};

type UseEventCardActionsParams = {
  event: Event | undefined;
  context: 'explore' | 'memories' | 'other_profile' | 'own_profile' | 'folder';
  relationship: 'organizer' | 'accepted' | 'waiting' | 'invited' | 'non_member' | 'rejected';
  isPast: boolean;
  participantsCount: number;
  isEventSaved: (eventId: string) => boolean;
  eventId: string;
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
  hasEventFolders,
  folderId,
}: UseEventCardActionsParams): EventAction[] {
  const { t } = useLanguage();

  const getSaveButtonLabel = () => {
    return isEventSaved(eventId) ? t.events.removeFromSaved : t.events.save;
  };

  /**
   * Пункты с плашкой «В разработке» в первой версии не показываем:
   * пустая заглушка в интерфейсе — повод для отказа при проверке в App Store
   * (см. constants/featureFlags.ts).
   */
  const finish = (list: EventAction[]) =>
    SHOW_IN_DEVELOPMENT_ITEMS ? list : list.filter(action => !action.inDevelopment);

  return useMemo(() => {
    if (!event) return [];

    const actions: EventAction[] = [];

    // ЛЕНТЫ EXPLORE (GLOB/FRIENDS)
    if (context === 'explore') {
      if (isPast) {
        // Участник/организатор прошедшего события должен получать тот же набор,
        // что и внутри профиля события: раньше здесь был «минимальный набор»
        // (только share+save), из-за чего «скрыть параметры» и «сменить фото
        // для себя» были доступны внутри события, но не из карточки в ленте.
        // Обработчики для обоих действий в EventCard уже реализованы.
        if (relationship === 'accepted' || relationship === 'organizer') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        if (relationship !== 'accepted' && relationship !== 'organizer') {
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
        return finish(actions);
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
        // Раньше участник видел в ленте ТОЛЬКО «перейти в чат» — ни отменить
        // участие, ни поделиться, ни сохранить; внутри события всё это было.
        actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation, isClickable: true });
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
        // Позвать людей в уже созданное событие. Раньше приглашать можно было
        // только в форме создания, а после публикации — никак.
        actions.push({ id: 'invite_friends', label: t.createEvent.inviteFriends, isClickable: true });
        actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true, inDevelopment: true });
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
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true, inDevelopment: true });
          actions.push({ id: 'change_photo', label: t.events.changePhoto, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true, inDevelopment: true });
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
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation, isClickable: true });
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
          actions.push({ id: 'invite_friends', label: t.createEvent.inviteFriends, isClickable: true });
          // Пункт один — «Отменить событие», и при нескольких участниках по
          // нему открывается окно передачи роли (так же, как в ленте и внутри
          // самого события). Раньше здесь вместо него подставлялся
          // 'transfer_organizer_role', для которого в EventCard нет обработчика
          // вовсе: нажатие просто закрывало меню и ничего не делало.
          actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
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
          actions.push({ id: 'schedule', label: t.events.schedule, isClickable: true });
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
          // У прошедшего события в СВОЁМ профиле пункт рабочий: он меняет,
          // кому это событие видно именно у меня (см. EventCard).
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || t.common.delete, isClickable: true });
          // «Перейти в чат» доступен и у ПРОШЕДШИХ событий: чат никуда не
          // девается, а в трёх точках этого пункта не было — попасть в него
          // можно было только значком внутри события. Условие то же, что и у
          // предстоящих: чат существует от двух участников.
          actions.push({
            id: 'go_to_chat',
            label: t.events.goToChat,
            isClickable: participantsCount >= 2,
          });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else if (relationship === 'organizer') {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || t.common.delete, isClickable: true });
          // «Перейти в чат» доступен и у ПРОШЕДШИХ событий: чат никуда не
          // девается, а в трёх точках этого пункта не было — попасть в него
          // можно было только значком внутри события. Условие то же, что и у
          // предстоящих: чат существует от двух участников.
          actions.push({
            id: 'go_to_chat',
            label: t.events.goToChat,
            isClickable: participantsCount >= 2,
          });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
      } else {
        if (relationship === 'accepted') {
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true, inDevelopment: true });
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
          actions.push({ id: 'invite_friends', label: t.createEvent.inviteFriends, isClickable: true });
          // Пункт один — «Отменить событие», и при нескольких участниках по
          // нему открывается окно передачи роли (так же, как в ленте и внутри
          // самого события). Раньше здесь вместо него подставлялся
          // 'transfer_organizer_role', для которого в EventCard нет обработчика
          // вовсе: нажатие просто закрывало меню и ничего не делало.
          actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true, inDevelopment: true });
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
        if (relationship === 'organizer' || relationship === 'accepted') {
          // «Перейти в чат» доступен и у ПРОШЕДШИХ событий: чат никуда не
          // девается, а в трёх точках этого пункта не было — попасть в него
          // можно было только значком внутри события. Условие то же, что и у
          // предстоящих: чат существует от двух участников.
          actions.push({
            id: 'go_to_chat',
            label: t.events.goToChat,
            isClickable: participantsCount >= 2,
          });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
    }

    // РАЗДЕЛ FOLDER (событие внутри папки)
    //
    // Набор тот же, что у прошедшего события в профиле, плюс «убрать из
    // папки». Раньше здесь был свой короткий список: ни «скрыть параметры»,
    // ни «сменить фото для себя», ни «перейти в чат» — зато был пункт
    // «показать/скрыть метки», который не делал ничего (он менял только
    // собственную подпись, см. удалённый toggle_tags).
    else if (context === 'folder') {
      if (isPast && folderId) {
        const isMember = relationship === 'organizer' || relationship === 'accepted';
        if (isMember) {
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_photo', label: t.events.changePhotoForSelf, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
        }
        actions.push({ id: 'remove_from_folder', label: t.events.removeFromFolder, isClickable: true });
        if (isMember) {
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || t.common.delete, isClickable: true });
          actions.push({
            id: 'go_to_chat',
            label: t.events.goToChat,
            isClickable: participantsCount >= 2,
          });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        if (!isMember) {
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
      }
    }

    return finish(actions);
  }, [
    event,
    context,
    relationship,
    isPast,
    participantsCount,
    isEventSaved,
    eventId,
    hasEventFolders,
    folderId,
    t,
    getSaveButtonLabel,
  ]);
}

