export interface PostComment {
  id: string;
<<<<<<< HEAD
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
=======
  authorId: string;
  content: string;
  createdAt?: Date;
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
}

export interface EventProfilePost {
  id: string;
  eventId: string;
  authorId: string;
  type?: 'photo' | 'video' | 'text' | 'music';
  content?: string; // URL для медиа или текст
<<<<<<< HEAD
  photoUrl?: string; // URL для фото (используется бэкендом, для обратной совместимости)
  photoUrls?: string[]; // Массив URL для карусели фото
  captions?: string[]; // Массив описаний для каждого фото в карусели
  caption?: string; // Общее описание поста (для обратной совместимости)
=======
  photoUrl?: string; // URL для фото (используется бэкендом)
  photoUrls?: string[]; // Массив URL для карусели
  captions?: string[]; // Массив подписей для каждого фото
  caption?: string;
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  title?: string; // Для музыки: название трека
  artist?: string; // Для музыки: исполнитель
  artwork_url?: string; // Для музыки: обложка трека
  createdAt: Date;
  showInProfile?: boolean; // Флаг для отображения в профиле пользователя
  comments?: PostComment[]; // Комментарии к посту
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

