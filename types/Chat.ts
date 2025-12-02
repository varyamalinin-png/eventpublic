export interface ChatMessage {
  id: string;
  chatId: string;
  fromUserId: string;
  text?: string; // Опционально, если есть eventId или postId
  eventId?: string; // ID события, если сообщение содержит событие
  postId?: string; // ID меморис поста, если сообщение содержит меморис пост
  createdAt: Date;
}

export interface Chat {
  id: string;
  type: 'event' | 'personal';
  eventId?: string; // Для событийных чатов
  name: string; // Название чата
  participants: string[]; // ID участников
  lastMessage?: ChatMessage;
  lastActivity: Date;
  createdAt: Date;
  avatar?: string; // Аватарка чата (для событийных чатов = фото события)
}

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: Date;
}

export interface MessageFolder {
  id: string;
  name: string;
  type?: 'default' | 'custom'; // 'default' - системные папки, 'custom' - созданные пользователем
  chatIds?: string[]; // ID чатов в этой папке (только для кастомных папок)
}

