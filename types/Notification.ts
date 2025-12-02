export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'EVENT_INVITE'
  | 'MESSAGE'
  | 'SYSTEM'
  | 'EVENT_CANCELLED'
  | 'EVENT_UPDATED'
  | 'EVENT_PARTICIPANT_JOINED'
  | 'EVENT_PARTICIPANT_LEFT'
  | 'EVENT_POST_ADDED';

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
  };
  readAt: Date | null;
  createdAt: Date;
}

