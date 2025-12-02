export interface EventProfilePost {
  id: string;
  eventId: string;
  authorId: string;
  type?: 'photo' | 'video' | 'text' | 'music';
  content?: string; // URL для медиа или текст
  photoUrl?: string; // URL для фото (используется бэкендом)
  caption?: string;
  title?: string; // Для музыки: название трека
  artist?: string; // Для музыки: исполнитель
  artwork_url?: string; // Для музыки: обложка трека
  createdAt: Date;
  showInProfile?: boolean; // Флаг для отображения в профиле пользователя
}

export interface EventProfile {
  id: string;
  eventId: string;
  name: string; // название события
  description: string; // описание события
  date: string;
  time: string; // HH:MM - время события
  location: string;
  participants: string[]; // ID участников
  organizerId: string;
  isCompleted: boolean;
  posts: EventProfilePost[];
  createdAt: Date;
  avatar?: string; // аватар события (равен фото в карточке события)
  hiddenParameters?: Record<string, boolean>; // Скрытые параметры карточки события (для меморис)
}

