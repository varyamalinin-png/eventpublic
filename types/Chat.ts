export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  fromUserId: string;
  text?: string;
  eventId?: string;
  postId?: string;
  readBy?: string[];
  reactions?: MessageReaction[];
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

