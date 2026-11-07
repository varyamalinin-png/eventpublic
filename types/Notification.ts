export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'EVENT_INVITE'
  | 'MESSAGE'
  | 'SYSTEM'
  | 'EVENT_CANCELLED'
  | 'EVENT_UPDATED'
  | 'EVENT_PARTICIPANT_JOINED'
  | 'EVENT_PARTICIPANT_LEFT'
  | 'EVENT_POST_ADDED'
  | 'EVENT_JOIN_REQUEST'
  | 'EVENT_REQUEST_ACCEPTED'
  // Предложение стать организатором — на него отвечают «принять/отклонить».
  | 'EVENT_ORGANIZER_TRANSFERRED'
  // С 1.0.0 (4): сервер отдаёт их только по ?extended=1 и шлёт по сокету
  // событием notification:created (см. server EXTENDED_NOTIFICATION_TYPES).
  | 'FRIEND_REQUEST_ACCEPTED'
  | 'EVENT_INVITE_DECLINED'
  | 'EVENT_POST_LIKED'
  | 'EVENT_POST_COMMENTED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: {
    eventId?: string;
    actorId?: string;
    actorName?: string;
    eventTitle?: string;
    eventMediaUrl?: string;
    changedField?: string;
    postId?: string;
    postPhotoUrl?: string;
    commentPreview?: string;
  };
  readAt: Date | null;
  createdAt: Date;
}

