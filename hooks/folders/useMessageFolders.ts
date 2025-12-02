import { useState, useCallback, useRef, useEffect } from 'react';
import type { MessageFolder } from '../../types/Chat';
import type { ServerUser, ServerMessageFolder } from '../../types/api';
import { apiRequest, ApiError } from '../../services/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useMessageFolders');

// Функция маппинга папки сообщений с сервера
const mapServerFolderToMessageFolder = (folder: ServerMessageFolder): MessageFolder => ({
  id: folder.id || '',
  name: folder.name || '',
  type: 'custom',
  chatIds: (Array.isArray(folder.chats) ? folder.chats : []).map((link) => {
    if (typeof link === 'string') return link;
    return (link as { chatId?: string; chat?: { id?: string } }).chatId || (link as { chat?: { id?: string } }).chat?.id;
  }).filter(Boolean) as string[],
});

export interface UseMessageFoldersParams {
  accessToken: string | null;
  currentUserId: string | null;
  applyServerUserDataToState: (user: ServerUser) => void;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
}

export interface UseMessageFoldersReturn {
  messageFolders: MessageFolder[];
  setMessageFolders: React.Dispatch<React.SetStateAction<MessageFolder[]>>;
  syncMessageFolders: () => Promise<void>;
  createMessageFolder: (name: string) => Promise<MessageFolder | null>;
  addChatsToMessageFolder: (folderId: string, chatIds: string[]) => Promise<void>;
  removeChatFromMessageFolder: (folderId: string, chatId: string) => Promise<void>;
}

export const useMessageFolders = ({
  accessToken,
  currentUserId,
  applyServerUserDataToState,
  handleUnauthorizedError,
}: UseMessageFoldersParams): UseMessageFoldersReturn => {
  const [messageFolders, setMessageFolders] = useState<MessageFolder[]>([]);
  const currentAccessTokenRef = useRef<string | null>(accessToken);

  // Обновляем ref при изменении токена через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
  }, [accessToken]);

  // Синхронизация папок сообщений с сервера
  const syncMessageFolders = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      const response = await apiRequest('/folders', {}, actualToken);
      if (Array.isArray(response)) {
        response.forEach((folder: any) => {
          (folder?.chats ?? []).forEach((link: any) => {
            const chat = link.chat;
            if (chat?.participants) {
              chat.participants.forEach((participant: any) => {
                if (participant?.user) {
                  applyServerUserDataToState(participant.user);
                }
              });
            }
            if (chat?.lastMessage?.sender) {
              applyServerUserDataToState(chat.lastMessage.sender);
            }
          });
        });
        setMessageFolders(response.map(mapServerFolderToMessageFolder));
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки не должны вызывать logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
      }
      logger.error('Failed to load message folders from API', error);
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  // Создать папку сообщений
  const createMessageFolder = useCallback(
    async (name: string): Promise<MessageFolder | null> => {
      const actualToken = currentAccessTokenRef.current;
      if (!actualToken) return null;
      try {
        const response = await apiRequest(
          '/folders',
          {
            method: 'POST',
            body: JSON.stringify({ name }),
          },
          actualToken,
        );
        if (response) {
          const folder = mapServerFolderToMessageFolder(response);
          setMessageFolders(prev => [...prev, folder]);
          return folder;
        }
      } catch (error) {
        logger.error('Failed to create message folder', error);
      }
      return null;
    },
    [],
  );

  // Добавить чаты в папку сообщений
  const addChatsToMessageFolder = useCallback(
    async (folderId: string, chatIds: string[]) => {
      const actualToken = currentAccessTokenRef.current;
      if (!actualToken || chatIds.length === 0) return;
      try {
        let latest: any = null;
        for (const chatId of chatIds) {
          latest = await apiRequest(
            `/folders/${folderId}/chats`,
            {
              method: 'POST',
              body: JSON.stringify({ chatId }),
            },
            actualToken,
          );
        }
        if (Array.isArray(latest)) {
          setMessageFolders(latest.map(mapServerFolderToMessageFolder));
        } else {
          await syncMessageFolders();
        }
      } catch (error) {
        logger.error('Failed to add chats to folder', error);
      }
    },
    [syncMessageFolders],
  );

  // Удалить чат из папки сообщений
  const removeChatFromMessageFolder = useCallback(
    async (folderId: string, chatId: string) => {
      const actualToken = currentAccessTokenRef.current;
      if (!actualToken) return;
      try {
        const response = await apiRequest(
          `/folders/${folderId}/chats/${chatId}`,
          {
            method: 'DELETE',
          },
          actualToken,
        );
        if (Array.isArray(response)) {
          setMessageFolders(response.map(mapServerFolderToMessageFolder));
        } else {
          setMessageFolders(prev =>
            prev.map(folder =>
              folder.id === folderId
                ? { ...folder, chatIds: (folder.chatIds ?? []).filter(id => id !== chatId) }
                : folder,
            ),
          );
        }
      } catch (error) {
        logger.error('Failed to remove chat from folder', error);
      }
    },
    [],
  );

  return {
    messageFolders,
    setMessageFolders,
    syncMessageFolders,
    createMessageFolder,
    addChatsToMessageFolder,
    removeChatFromMessageFolder,
  };
};

