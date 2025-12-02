import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest, ApiError } from '../../services/api';
import type { FriendRequest, User } from '../../types';
import type { ServerUser, ServerFriendRequest } from '../../types/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Friends');

// Утилита для маппинга запросов в друзья с сервера
const mapServerFriendRequest = (request: ServerFriendRequest): FriendRequest | null => {
  if (!request?.id) {
    return null;
  }

  const fromUserId = request.requesterId ?? request.requester?.id;
  const toUserId = request.addresseeId ?? request.addressee?.id;
  if (!fromUserId || !toUserId) {
    return null;
  }

  const statusRaw = String(request.status ?? 'pending').toLowerCase();
  const status: FriendRequest['status'] =
    statusRaw === 'accepted' || statusRaw === 'rejected' ? (statusRaw as FriendRequest['status']) : 'pending';

  return {
    id: request.id,
    fromUserId,
    toUserId,
    status,
    createdAt: request.createdAt ? new Date(request.createdAt) : new Date(),
  };
};

export interface UseFriendsReturn {
  friends: string[];
  friendRequests: FriendRequest[];
  userFriendsMap: Record<string, string[]>;
  sendFriendRequest: (toUserId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  respondToFriendRequest: (requestId: string, accepted: boolean) => Promise<void>;
  syncFriendsFromServer: () => Promise<void>;
  syncFriendRequestsFromServer: () => Promise<void>;
  setFriends: React.Dispatch<React.SetStateAction<string[]>>;
  setFriendRequests: React.Dispatch<React.SetStateAction<FriendRequest[]>>;
  setUserFriendsMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export interface UseFriendsParams {
  accessToken: string | null;
  currentUserId: string | null;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
  applyServerUserDataToState: (serverUser: ServerUser) => void;
}

export function useFriends({
  accessToken,
  currentUserId,
  handleUnauthorizedError,
  applyServerUserDataToState,
}: UseFriendsParams): UseFriendsReturn {
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [userFriendsMap, setUserFriendsMap] = useState<Record<string, string[]>>({});
  
  const currentAccessTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Обновляем refs при изменении токена или userId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  const addLocalFriend = useCallback(
    (friendId: string) => {
      if (!currentUserId) return;
      setFriends(prev => (prev.includes(friendId) ? prev : [...prev, friendId]));
      setUserFriendsMap(prev => {
        const updated = { ...prev };
        if (!updated[currentUserId]) updated[currentUserId] = [];
        if (!updated[currentUserId].includes(friendId)) {
          updated[currentUserId] = [...updated[currentUserId], friendId];
        }
        if (!updated[friendId]) updated[friendId] = [];
        if (!updated[friendId].includes(currentUserId)) {
          updated[friendId] = [...updated[friendId], currentUserId];
        }
        return updated;
      });
    },
    [currentUserId],
  );

  const removeLocalFriend = useCallback(
    (friendId: string) => {
      if (!currentUserId) return;
      setFriends(prev => prev.filter(id => id !== friendId));
      setUserFriendsMap(prev => {
        const updated = { ...prev };
        if (updated[currentUserId]) {
          updated[currentUserId] = updated[currentUserId].filter(id => id !== friendId);
        }
        if (updated[friendId]) {
          updated[friendId] = updated[friendId].filter(id => id !== currentUserId);
        }
        return updated;
      });
    },
    [currentUserId],
  );

  const syncFriendsFromServer = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) return;
    
    try {
      const response = await apiRequest('/friends', {}, actualToken);
      if (Array.isArray(response)) {
        const friendIds = new Set<string>();
        const aggregatedMap: Record<string, string[]> = {};

        response.forEach((friendship: any) => {
          if (friendship?.requester) {
            applyServerUserDataToState(friendship.requester);
          }
          if (friendship?.addressee) {
            applyServerUserDataToState(friendship.addressee);
          }

          const requesterId = friendship.requesterId ?? friendship.requester?.id;
          const addresseeId = friendship.addresseeId ?? friendship.addressee?.id;
          if (!requesterId || !addresseeId) {
            return;
          }

          if (!aggregatedMap[requesterId]) aggregatedMap[requesterId] = [];
          if (!aggregatedMap[requesterId].includes(addresseeId)) {
            aggregatedMap[requesterId].push(addresseeId);
          }
          if (!aggregatedMap[addresseeId]) aggregatedMap[addresseeId] = [];
          if (!aggregatedMap[addresseeId].includes(requesterId)) {
            aggregatedMap[addresseeId].push(requesterId);
          }

          if (requesterId === actualUserId) {
            friendIds.add(addresseeId);
          }
          if (addresseeId === actualUserId) {
            friendIds.add(requesterId);
          }
        });

        const friendsArray = Array.from(friendIds);
        setFriends(friendsArray);
        setUserFriendsMap(prev => {
          // Объединяем существующие данные с новыми, а не перезаписываем
          const updated = { ...prev, ...aggregatedMap };
          // Убеждаемся, что для текущего пользователя список друзей актуален
          if (!updated[actualUserId]) {
            updated[actualUserId] = friendsArray;
          } else {
            // Обновляем список друзей текущего пользователя, сохраняя данные о друзьях других пользователей
            updated[actualUserId] = friendsArray;
          }
          return updated;
        });
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки не должны вызывать logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
      }
      logger.error('Failed to load friends from API', error);
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  const syncFriendRequestsFromServer = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) return;
    
    try {
      const response = await apiRequest('/friends/requests', {}, actualToken);
      if (response && typeof response === 'object') {
        const incoming = Array.isArray((response as any).incoming) ? (response as any).incoming : [];
        const outgoing = Array.isArray((response as any).outgoing) ? (response as any).outgoing : [];
        const mappedRequests: FriendRequest[] = [];

        [...incoming, ...outgoing].forEach((request: any) => {
          if (request?.requester) {
            applyServerUserDataToState(request.requester);
          }
          if (request?.addressee) {
            applyServerUserDataToState(request.addressee);
          }
          const mapped = mapServerFriendRequest(request);
          if (mapped) {
            mappedRequests.push(mapped);
          }
        });

        setFriendRequests(mappedRequests);
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки не должны вызывать logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
      }
      logger.error('Failed to load friend requests from API', error);
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  const sendFriendRequest = useCallback(
    async (toUserId: string) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualUserId) return;
      if (toUserId === actualUserId) return;
      const isMockUser = toUserId.startsWith('organizer-');

      if (isMockUser) {
        addLocalFriend(toUserId);
        return;
      }

      const optimisticRequest: FriendRequest = {
        id: `pending-${Date.now()}`,
        fromUserId: actualUserId,
        toUserId,
        status: 'pending',
        createdAt: new Date(),
      };

      setFriendRequests(prev => {
        const filtered = prev.filter(req => req.id !== optimisticRequest.id);
        return [...filtered, optimisticRequest];
      });

      if (actualToken) {
        try {
          await apiRequest(`/friends/${toUserId}`, { method: 'POST' }, actualToken);
          await Promise.all([syncFriendRequestsFromServer(), syncFriendsFromServer()]);
        } catch (error) {
          logger.error('Failed to add friend', error);
          setFriendRequests(prev => prev.filter(req => req.id !== optimisticRequest.id));
          await syncFriendRequestsFromServer();
        }
      }
    },
    [addLocalFriend, syncFriendsFromServer, syncFriendRequestsFromServer],
  );

  const removeFriend = useCallback(
    async (userId: string) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualUserId) return;
      removeLocalFriend(userId);
      const isMockUser = userId.startsWith('organizer-');
      if (actualToken && !isMockUser) {
        try {
          await apiRequest(`/friends/${userId}`, { method: 'DELETE' }, actualToken);
          await Promise.all([syncFriendsFromServer(), syncFriendRequestsFromServer()]);
        } catch (error) {
          logger.error('Failed to remove friend', error);
        }
      }
    },
    [removeLocalFriend, syncFriendsFromServer, syncFriendRequestsFromServer],
  );

  const respondToFriendRequest = useCallback(
    async (requestId: string, accepted: boolean) => {
      const actualToken = currentAccessTokenRef.current;
      if (!actualToken) return;
      try {
        await apiRequest(
          `/friends/requests/${requestId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accept: accepted }),
          },
          actualToken,
        );
        await Promise.all([syncFriendsFromServer(), syncFriendRequestsFromServer()]);
      } catch (error) {
        logger.error('Failed to respond to friend request', error);
      }
    },
    [syncFriendsFromServer, syncFriendRequestsFromServer],
  );

  return {
    friends,
    friendRequests,
    userFriendsMap,
    sendFriendRequest,
    removeFriend,
    respondToFriendRequest,
    syncFriendsFromServer,
    syncFriendRequestsFromServer,
    setFriends,
    setFriendRequests,
    setUserFriendsMap,
  };
}

