import { useState, useCallback } from 'react';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useSavedMemoryPosts');

export interface SavedMemoryPost {
  eventId: string;
  postId: string;
}

export interface UseSavedMemoryPostsParams {
  eventProfiles: Array<{ eventId: string; posts: Array<{ id: string }> }>;
}

export interface UseSavedMemoryPostsReturn {
  savedMemoryPosts: SavedMemoryPost[];
  setSavedMemoryPosts: React.Dispatch<React.SetStateAction<SavedMemoryPost[]>>;
  saveMemoryPost: (eventId: string, postId: string) => void;
  removeSavedMemoryPost: (eventId: string, postId: string) => void;
  isMemoryPostSaved: (eventId: string, postId: string) => boolean;
  getSavedMemoryPosts: <T extends { id: string }>(eventProfiles: Array<{ eventId: string; posts: T[] }>) => Array<{ post: T; eventId: string }>;
}

export const useSavedMemoryPosts = ({
  eventProfiles,
}: UseSavedMemoryPostsParams): UseSavedMemoryPostsReturn => {
  const [savedMemoryPosts, setSavedMemoryPosts] = useState<SavedMemoryPost[]>([]);

  // Сохранение меморис поста
  const saveMemoryPost = useCallback((eventId: string, postId: string) => {
    setSavedMemoryPosts(prev => {
      const exists = prev.find(p => p.eventId === eventId && p.postId === postId);
      if (exists) {
        return prev;
      }
      logger.debug('Меморис пост сохранен:', { eventId, postId });
      return [...prev, { eventId, postId }];
    });
  }, []);

  // Удаление сохраненного меморис поста
  const removeSavedMemoryPost = useCallback((eventId: string, postId: string) => {
    setSavedMemoryPosts(prev => {
      const filtered = prev.filter(p => !(p.eventId === eventId && p.postId === postId));
      if (filtered.length !== prev.length) {
        logger.debug('Меморис пост удален из сохраненных:', { eventId, postId });
      }
      return filtered;
    });
  }, []);

  // Проверка, сохранен ли меморис пост
  const isMemoryPostSaved = useCallback((eventId: string, postId: string): boolean => {
    return savedMemoryPosts.some(p => p.eventId === eventId && p.postId === postId);
  }, [savedMemoryPosts]);

  // Получить список сохраненных меморис постов с полными данными
  const getSavedMemoryPosts = useCallback(<T extends { id: string }>(eventProfiles: Array<{ eventId: string; posts: T[] }>): Array<{ post: T; eventId: string }> => {
    const result: Array<{ post: T; eventId: string }> = [];
    savedMemoryPosts.forEach(({ eventId, postId }) => {
      const profile = eventProfiles.find(p => p.eventId === eventId);
      if (profile) {
        const post = profile.posts.find(p => p.id === postId);
        if (post) {
          result.push({ post, eventId });
        }
      }
    });
    return result;
  }, [savedMemoryPosts]);

  return {
    savedMemoryPosts,
    setSavedMemoryPosts,
    saveMemoryPost,
    removeSavedMemoryPost,
    isMemoryPostSaved,
    getSavedMemoryPosts,
  };
};

