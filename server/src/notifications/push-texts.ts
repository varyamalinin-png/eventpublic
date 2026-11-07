import { NotificationType } from '@prisma/client';

/**
 * Тексты пуш-уведомлений.
 *
 * Повторяют формулировки из ленты уведомлений в приложении
 * (client/components/NotificationItem.tsx) — чтобы пуш и то, что человек
 * увидит, открыв приложение, говорили одно и то же.
 *
 * Язык берём из PushToken.language: сервер не знает, какой язык выбран в
 * приложении, поэтому клиент присылает его вместе с токеном.
 */
type Payload = {
  actorName?: string;
  eventTitle?: string;
  changedField?: string;
  commentPreview?: string;
  [key: string]: unknown;
};

type PushText = { title: string; body: string } | null;

const RU = {
  app: 'iwent',
  someone: 'Пользователь',
  event: 'событие',
  parameters: 'параметры',
  changedIn: (who: string, what: string, title: string) =>
    `${who} изменил(а) ${what} в «${title}»`,
  cancelled: (who: string) => `${who} отменил(а) событие`,
  joined: (who: string, title: string) => `${who} присоединился(ась) к «${title}»`,
  left: (who: string, title: string) => `${who} покинул(а) событие «${title}»`,
  posted: (who: string, title: string) => `${who} добавил(а) публикацию в «${title}»`,
  joinRequest: (who: string, title: string) => `${who} просится в «${title}»`,
  requestAccepted: (who: string, title: string) =>
    `${who} принял(а) вашу заявку в «${title}»`,
  friendRequest: (who: string) => `${who} хочет добавить вас в друзья`,
  invite: (who: string, title: string) => `${who} приглашает вас в «${title}»`,
  message: (who: string) => `Новое сообщение от ${who}`,
  organizerTransferred: (title: string) => `Вы теперь организатор «${title}»`,
  friendAccepted: (who: string) => `${who} принял(а) вашу заявку в друзья`,
  inviteDeclined: (who: string, title: string) => `${who} отклонил(а) приглашение в «${title}»`,
  postLiked: (who: string, title: string) => `${who} оценил(а) вашу публикацию в «${title}»`,
  postCommented: (who: string, text: string) => `${who} прокомментировал(а) вашу публикацию: «${text}»`,
  postCommentedIn: (who: string, title: string) =>
    `${who} прокомментировал(а) вашу публикацию в «${title}»`,
};

const EN = {
  app: 'iwent',
  someone: 'Someone',
  event: 'event',
  parameters: 'parameters',
  changedIn: (who: string, what: string, title: string) =>
    `${who} changed ${what} in “${title}”`,
  cancelled: (who: string) => `${who} cancelled the event`,
  joined: (who: string, title: string) => `${who} joined “${title}”`,
  left: (who: string, title: string) => `${who} left “${title}”`,
  posted: (who: string, title: string) => `${who} added a post to “${title}”`,
  joinRequest: (who: string, title: string) => `${who} asked to join “${title}”`,
  requestAccepted: (who: string, title: string) =>
    `${who} accepted your request to join “${title}”`,
  friendRequest: (who: string) => `${who} wants to be your friend`,
  invite: (who: string, title: string) => `${who} invited you to “${title}”`,
  message: (who: string) => `New message from ${who}`,
  organizerTransferred: (title: string) => `You are now the organizer of “${title}”`,
  friendAccepted: (who: string) => `${who} accepted your friend request`,
  inviteDeclined: (who: string, title: string) => `${who} declined your invitation to “${title}”`,
  postLiked: (who: string, title: string) => `${who} liked your post in “${title}”`,
  postCommented: (who: string, text: string) => `${who} commented on your post: “${text}”`,
  postCommentedIn: (who: string, title: string) => `${who} commented on your post in “${title}”`,
};

export function buildPushText(
  type: NotificationType,
  payload: Payload,
  language: string,
): PushText {
  const L = language === 'ru' ? RU : EN;
  const who = payload.actorName || L.someone;
  const title = payload.eventTitle || L.event;

  switch (type) {
    case 'EVENT_UPDATED':
      return { title: L.app, body: L.changedIn(who, payload.changedField || L.parameters, title) };
    case 'EVENT_CANCELLED':
      return { title: L.app, body: L.cancelled(who) };
    case 'EVENT_PARTICIPANT_JOINED':
      return { title: L.app, body: L.joined(who, title) };
    case 'EVENT_PARTICIPANT_LEFT':
      return { title: L.app, body: L.left(who, title) };
    case 'EVENT_POST_ADDED':
      return { title: L.app, body: L.posted(who, title) };
    case 'EVENT_JOIN_REQUEST':
      return { title: L.app, body: L.joinRequest(who, title) };
    case 'EVENT_REQUEST_ACCEPTED':
      return { title: L.app, body: L.requestAccepted(who, title) };
    case 'FRIEND_REQUEST':
      return { title: L.app, body: L.friendRequest(who) };
    case 'EVENT_INVITE':
      return { title: L.app, body: L.invite(who, title) };
    case 'MESSAGE':
      return { title: L.app, body: L.message(who) };
    case 'EVENT_ORGANIZER_TRANSFERRED':
      return { title: L.app, body: L.organizerTransferred(title) };
    case 'FRIEND_REQUEST_ACCEPTED':
      return { title: L.app, body: L.friendAccepted(who) };
    case 'EVENT_INVITE_DECLINED':
      return { title: L.app, body: L.inviteDeclined(who, title) };
    case 'EVENT_POST_LIKED':
      return { title: L.app, body: L.postLiked(who, title) };
    case 'EVENT_POST_COMMENTED':
      return {
        title: L.app,
        body: payload.commentPreview
          ? L.postCommented(who, payload.commentPreview)
          : L.postCommentedIn(who, title),
      };
    // SYSTEM без собственного текста пушить нечем: в ленте для него тоже
    // показывается только «Новое уведомление».
    case 'SYSTEM':
    default:
      return null;
  }
}
