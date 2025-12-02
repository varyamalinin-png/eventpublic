export interface Event {
  id: string;
  title: string;
  description: string;
  date: string; // Формат: "2024-05-15"
  time: string; // Формат: "18:00"
  displayDate: string; // Формат: "15 мая" - для отображения
  displayTime: string; // Формат: "18:00" - для отображения
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price: string;
  participants: number;
  maxParticipants: number;
  organizerAvatar: string;
  organizerId: string;
  mediaUrl?: string; // Обрезанное фото для карточки события
  originalMediaUrl?: string; // Оригинальное фото для профиля события
  mediaType?: 'image' | 'video';
  mediaAspectRatio?: number;
  participantsList?: string[];
  participantsData?: Array<{ avatar: string; userId: string; name?: string }>;
  createdAt: Date;
  personalPhotos?: Record<string, string>; // Map userId -> photoUrl для персональных фото участников
  // Новые поля для системы приглашений и фильтров
  ageRestriction?: {
    min: number;
    max: number;
  };
  genderRestriction?: string[]; // ['male', 'female', 'other']
  visibility?: {
    type: 'all' | 'friends' | 'all_except_friends' | 'all_except_excluded' | 'only_me' | 'me_and_excluded';
    excludedUsers?: string[]; // UserID[]
  };
  invitedUsers?: string[]; // UserID[] - массив приглашенных пользователей
  // Поля для регулярных событий
  isRecurring?: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom'; // Тип регулярности
  recurringDays?: number[]; // Для weekly: [1,3,5] = понедельник, среда, пятница
  recurringDayOfMonth?: number; // Для monthly: день месяца (1-31)
  recurringCustomDates?: string[]; // Для custom: массив дат в формате "YYYY-MM-DD"
  // Метки (теги) события
  tags?: string[]; // Массив меток (автоматические и пользовательские)
}

