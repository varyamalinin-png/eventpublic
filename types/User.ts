export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  age: string;
  bio: string;
  geoPosition: string;
  accountType?: 'personal' | 'business'; // Тип аккаунта: личный или бизнес
  gender?: string; // 'male' | 'female' | … — необязателен, у большинства не указан
}

export interface UserFolder {
  id: string;
  name: string;
  userIds: string[];
}

