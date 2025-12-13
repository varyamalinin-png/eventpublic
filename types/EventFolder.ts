import type { Event } from './Event';
import type { User } from './User';

export interface EventFolder {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  coverPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
  events?: Event[];
  eventCount?: number;
  duration?: {
    start: string;
    end: string;
  };
  participants?: User[];
}

export interface EventFolderEvent {
  folderId: string;
  eventId: string;
  addedAt: string;
  event: Event;
}

export interface CreateEventFolderDto {
  name: string;
  description?: string;
  coverPhoto?: File | { uri: string; type: string; name: string };
}

export interface UpdateEventFolderDto {
  name?: string;
  description?: string;
  coverPhoto?: File | { uri: string; type: string; name: string };
}
