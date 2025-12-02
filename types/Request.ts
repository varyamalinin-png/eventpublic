export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface EventRequest {
  id: string;
  type: 'join' | 'invite'; // Тип запроса: join - пользователь хочет присоединиться, invite - пользователь приглашен
  eventId: string;
  fromUserId: string; // ID пользователя, отправившего запрос/приглашение
  toUserId: string; // ID пользователя, получившего запрос/приглашение
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  // Для обратной совместимости (старые запросы могут не иметь type и fromUserId)
  userId?: string; // Старое поле, использовать только если type отсутствует
}

export interface ScheduledEvent {
  id: string;
  eventId: string;
  time: string; // HH:MM
  date: string; // YYYY-MM-DD
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

