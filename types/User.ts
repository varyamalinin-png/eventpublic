export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  age: string;
  bio: string;
  geoPosition: string;
  accountType?: 'personal' | 'business'; // Тип аккаунта: личный или бизнес
}

export interface UserFolder {
  id: string;
  name: string;
  userIds: string[];
}

