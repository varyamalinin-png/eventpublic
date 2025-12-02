import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiRequest, ApiError } from '../services/api';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const ACCOUNTS_KEY = 'auth.accounts.v1';
const ACTIVE_ACCOUNT_KEY = 'auth.activeAccountId.v1';

interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  name?: string;
  accountType?: 'personal' | 'business'; // Тип аккаунта: личный или бизнес
}

export interface StoredAccount {
  userId: string;
  email: string | null;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  lastUsedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  age?: string;
  geoPosition?: string;
  dateOfBirth?: string;
  showAge?: boolean;
  accountType?: 'personal' | 'business';
  emailVerified?: boolean; // Статус подтверждения email
}

interface AuthContextShape {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  accounts: StoredAccount[];
  activeAccountId: string | null;
  initializing: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  verifyEmail: (token: string) => Promise<{ accessToken?: string; refreshToken?: string; user?: AuthUser; message?: string } | void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => Promise<boolean>;
  switchAccount: (userId: string) => Promise<void>;
  removeAccount: (userId: string) => Promise<void>;
  isMyAccount: (userId: string) => boolean; // Проверяет, является ли userId одним из сохраненных аккаунтов
  refreshSession: (token?: string) => Promise<void>; // Обновляет сессию с помощью refresh token
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

async function storageGet(key: string, useSecureStore: boolean) {
  try {
    if (useSecureStore) {
      return await SecureStore.getItemAsync(key);
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (error) {
    console.warn('[Auth] Failed to read token from storage', error);
  }
  return null;
}

async function storageSet(key: string, value: string, useSecureStore: boolean) {
  try {
    if (useSecureStore) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn('[Auth] Failed to persist value', error);
  }
}

async function storageDelete(key: string, useSecureStore: boolean) {
  try {
    if (useSecureStore) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('[Auth] Failed to delete value from storage', error);
  }
}

const parseAccounts = (raw: string | null): StoredAccount[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item: Partial<StoredAccount> & { userId?: string; accessToken?: string }) => {
        if (!item?.userId || !item?.accessToken) {
          return null;
        }
        return {
          userId: String(item.userId),
          email: item.email ?? null,
          username: item.username ?? null,
          name: item.name ?? null,
          avatarUrl: item.avatarUrl ?? null,
          accessToken: String(item.accessToken),
          refreshToken: item.refreshToken && item.refreshToken.trim() !== '' ? String(item.refreshToken) : '',
          lastUsedAt: item.lastUsedAt ?? new Date().toISOString(),
        } as StoredAccount;
      })
      .filter(Boolean) as StoredAccount[];
  } catch (error) {
    console.warn('[Auth] Failed to parse stored accounts', error);
    return [];
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [secureStorageAvailable, setSecureStorageAvailable] = useState<boolean>(true);

  const updateAccounts = useCallback(
    async (updater: (prev: StoredAccount[]) => StoredAccount[], options?: { skipWarning?: boolean }) => {
      // КРИТИЧЕСКИ ВАЖНО: Всегда читаем из storage перед обновлением
      // Это гарантирует, что мы работаем с актуальными данными
      const accountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
      const storageAccounts = parseAccounts(accountsRaw);
      
      // Используем аккаунты из storage, если они есть, иначе из состояния React
      const accountsToUse = storageAccounts.length > 0 ? storageAccounts : accounts;
      
      // Применяем updater к актуальным данным
      const next = updater(accountsToUse);
      
      // Важно: сохраняем ВСЕ аккаунты, включая неактивные
      console.log('[Auth] updateAccounts: обновление аккаунтов, было:', accountsToUse.length, 'стало:', next.length);
      if (next.length < accountsToUse.length && !options?.skipWarning) {
        // Пропускаем предупреждение только если это намеренное удаление (например, при logout последнего аккаунта)
        console.error('[Auth] updateAccounts: ВНИМАНИЕ! Количество аккаунтов уменьшилось! Было:', accountsToUse.length, 'стало:', next.length, 'потерянные:', accountsToUse.filter(p => !next.find(n => n.userId === p.userId)).map(a => a.userId));
      }
      
      // Сохраняем в storage ПЕРЕД обновлением состояния React
      await storageSet(ACCOUNTS_KEY, JSON.stringify(next), secureStorageAvailable);
      
      // Теперь обновляем состояние React
      setAccounts(next);
    },
    [secureStorageAvailable, accounts],
  );

  const persistActiveAccount = useCallback(
    async (accountId: string | null) => {
      setActiveAccountId(accountId);
      if (accountId) {
        await storageSet(ACTIVE_ACCOUNT_KEY, accountId, secureStorageAvailable);
      } else {
        await storageDelete(ACTIVE_ACCOUNT_KEY, secureStorageAvailable);
      }
    },
    [secureStorageAvailable],
  );

  const setSession = useCallback(
    async ({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    }: {
      accessToken: string;
      refreshToken?: string;
    }) => {
      // Обновляем токены синхронно в состоянии React
      setAccessToken(nextAccessToken);
      if (typeof nextRefreshToken === 'string') {
        setRefreshToken(nextRefreshToken);
      }
      // Сохраняем в storage асинхронно
      await storageSet(ACCESS_TOKEN_KEY, nextAccessToken, secureStorageAvailable);
      if (typeof nextRefreshToken === 'string') {
        await storageSet(REFRESH_TOKEN_KEY, nextRefreshToken, secureStorageAvailable);
      }
      // Даем React время обновить состояние перед возвратом
      await new Promise(resolve => setTimeout(resolve, 0));
    },
    [secureStorageAvailable],
  );

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    await storageDelete(ACCESS_TOKEN_KEY, secureStorageAvailable);
    await storageDelete(REFRESH_TOKEN_KEY, secureStorageAvailable);
  }, [secureStorageAvailable]);

  // Очищает сессию и удаляет неактуальный аккаунт из списка (используется при 401 ошибке)
  const clearSessionAndRemoveAccount = useCallback(async (userIdToRemove: string | null | undefined) => {
    // КРИТИЧЕСКИ ВАЖНО: Читаем activeAccountId из storage напрямую, так как состояние может быть устаревшим
    const activeIdFromStorage = await storageGet(ACTIVE_ACCOUNT_KEY, secureStorageAvailable);
    const currentActiveId = userIdToRemove || activeIdFromStorage || activeAccountId;
    
    console.log('[Auth] clearSessionAndRemoveAccount: удаление аккаунта', currentActiveId, 'userIdToRemove:', userIdToRemove, 'activeAccountId:', activeAccountId, 'activeIdFromStorage:', activeIdFromStorage);
    
    // Очищаем сессию
    await clearSession();
    
    // Если есть userId для удаления, удаляем аккаунт из списка
    if (currentActiveId) {
      await updateAccounts(prev => {
        const filtered = prev.filter(acc => acc.userId !== currentActiveId);
        console.log('[Auth] clearSessionAndRemoveAccount: удален аккаунт', currentActiveId, 'осталось аккаунтов:', filtered.length);
        return filtered;
      }, { skipWarning: true });
      
      // Если удаляемый аккаунт был активным, очищаем activeAccountId
      if (activeIdFromStorage === currentActiveId || activeAccountId === currentActiveId) {
        await persistActiveAccount(null);
        // Если есть другие аккаунты, переключаемся на первый
        const accountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
        const parsedAccounts = parseAccounts(accountsRaw);
        if (parsedAccounts.length > 0) {
          const nextAccount = parsedAccounts[0];
          await persistActiveAccount(nextAccount.userId);
          await setSession({ accessToken: nextAccount.accessToken, refreshToken: nextAccount.refreshToken });
          setUser({
            id: nextAccount.userId,
            email: nextAccount.email,
            username: nextAccount.username,
            name: nextAccount.name,
            avatarUrl: nextAccount.avatarUrl,
          });
        }
      }
    }
  }, [clearSession, updateAccounts, activeAccountId, persistActiveAccount, setSession, setUser, secureStorageAvailable]);

  const upsertAccount = useCallback(
    async (accountUser: AuthUser, tokens: { accessToken: string; refreshToken?: string }) => {
      if (!accountUser?.id || !tokens.accessToken) {
        console.warn('[Auth] upsertAccount: пропущено - нет accountUser.id или accessToken');
        return;
      }
      
      await updateAccounts(prev => {
        // ВАЖНО: updateAccounts теперь сам читает из storage, prev уже актуальный
        const existing = prev.find(acc => acc.userId === accountUser.id);
        // Используем новый refreshToken только если он валиден (не пустая строка)
        // Иначе сохраняем существующий, если он есть
        const newRefreshToken = tokens.refreshToken && tokens.refreshToken.trim() !== '' 
          ? tokens.refreshToken 
          : (existing?.refreshToken && existing.refreshToken.trim() !== '' ? existing.refreshToken : '');
        const updated: StoredAccount = {
          userId: accountUser.id,
          email: accountUser.email ?? existing?.email ?? null,
          username: accountUser.username ?? existing?.username ?? null,
          name: accountUser.name ?? existing?.name ?? null,
          avatarUrl: accountUser.avatarUrl ?? existing?.avatarUrl ?? null,
          accessToken: tokens.accessToken,
          refreshToken: newRefreshToken,
          lastUsedAt: new Date().toISOString(),
        };
        // КРИТИЧЕСКИ ВАЖНО: сохраняем ВСЕ существующие аккаунты, только обновляем текущий
        const otherAccounts = prev.filter(acc => acc.userId !== updated.userId);
        const result = [updated, ...otherAccounts];
        console.log('[Auth] upsertAccount: сохранено аккаунтов:', result.length, 'обновлен:', updated.userId, 'другие аккаунты:', otherAccounts.map(a => a.userId));
        if (result.length < prev.length) {
          console.error('[Auth] upsertAccount: ВНИМАНИЕ! Количество аккаунтов уменьшилось! Было:', prev.length, 'стало:', result.length, 'потерянные:', prev.filter(a => !result.find(r => r.userId === a.userId)).map(a => a.userId));
        }
        return result;
      });
      // КРИТИЧЕСКИ ВАЖНО: Сохраняем активный аккаунт ПОСЛЕ обновления аккаунтов в storage
      // Это гарантирует, что activeAccountId будет установлен правильно
      await persistActiveAccount(accountUser.id);
    },
    [updateAccounts, persistActiveAccount, accounts, secureStorageAvailable],
  );

  // Нормализуем URL медиа (фикс смены IP у MinIO)
  const normalizeMediaUrl = useCallback((input?: string | null) => {
    if (!input) return undefined;
    try {
      // Получаем storage URL из переменной окружения или используем дефолтный
      const storageUrl = process.env.EXPO_PUBLIC_STORAGE_URL || 'http://192.168.0.39:9000';
      
      // Заменяем старые IP адреса на актуальный storage URL
      let normalized = input;
      normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:9000/g, storageUrl);
      normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:4000/g, storageUrl);
      
      return normalized || undefined;
    } catch {
      return input || undefined;
    }
  }, []);

  const fetchProfile = useCallback(
    async (tokenOverride: string | null = null) => {
      const tokenToUse = tokenOverride ?? accessToken;
      if (!tokenToUse) return;
      
      try {
        const profile = await apiRequest('/auth/me', {}, tokenToUse);
        
        // КРИТИЧЕСКИ ВАЖНО: Проверяем, что профиль валиден
        if (!profile || !profile.id) {
          console.warn('[Auth] Profile is invalid or user not found, clearing session');
          await clearSession();
          return;
        }
        
        // Нормализуем avatarUrl в профиле
        const normalized = {
          ...profile,
          avatarUrl: normalizeMediaUrl(profile?.avatarUrl) ?? null,
        };
        setUser(normalized);
        await upsertAccount(normalized, { accessToken: tokenToUse, refreshToken: refreshToken ?? undefined });
      } catch (error: any) {
        // Если получили 401 или 404 (пользователь не найден), пытаемся обновить токен или очищаем сессию
        if ((error?.status === 401 || error?.status === 404) && refreshToken && refreshToken.trim() !== '') {
          try {
            await refreshSession(refreshToken);
            // refreshSession уже обновил токены и вызвал fetchProfile, ничего не делаем
            return;
          } catch (refreshError) {
            console.warn('[Auth] Failed to refresh token after auth error in fetchProfile, removing account', refreshError);
            // Если refresh не удался, удаляем неактуальный аккаунт
            // КРИТИЧЕСКИ ВАЖНО: Получаем userId из storage напрямую, так как состояние может быть устаревшим
            const activeIdFromStorage = await storageGet(ACTIVE_ACCOUNT_KEY, secureStorageAvailable);
            const currentUserId = activeIdFromStorage || activeAccountId || user?.id || null;
            console.log('[Auth] fetchProfile refresh error: удаление аккаунта', currentUserId, 'activeAccountId:', activeAccountId, 'activeIdFromStorage:', activeIdFromStorage, 'user?.id:', user?.id);
            await clearSessionAndRemoveAccount(currentUserId);
            return;
          }
        } else if (error?.status === 401 || error?.status === 404) {
          // Если refresh token нет или refresh не удался, удаляем неактуальный аккаунт
          console.warn('[Auth] User not found or unauthorized, removing account');
          // КРИТИЧЕСКИ ВАЖНО: Получаем userId из storage напрямую, так как состояние может быть устаревшим
          const activeIdFromStorage = await storageGet(ACTIVE_ACCOUNT_KEY, secureStorageAvailable);
          const currentUserId = activeIdFromStorage || activeAccountId || user?.id || null;
          console.log('[Auth] fetchProfile: удаление аккаунта', currentUserId, 'activeAccountId:', activeAccountId, 'activeIdFromStorage:', activeIdFromStorage, 'user?.id:', user?.id);
          await clearSessionAndRemoveAccount(currentUserId);
          return;
        } else {
          throw error; // Пробрасываем другие ошибки
        }
      }
    },
    [accessToken, refreshToken, upsertAccount, refreshSession, clearSession, clearSessionAndRemoveAccount, activeAccountId, user?.id, secureStorageAvailable],
  );

  const handleAccountAuthFailure = useCallback(
    async (failingAccountId: string | null) => {
      const failureKey = failingAccountId || 'null';
      
      // Защита от рекурсивных вызовов
      if (handlingAuthFailure.current.has(failureKey)) {
        console.warn('[Auth] Already handling auth failure for:', failingAccountId, '- skipping recursive call');
        return false;
      }
      
      handlingAuthFailure.current.add(failureKey);
      console.log('[Auth] Handling account auth failure for:', failingAccountId);
      
      try {
        // Удаляем невалидный аккаунт
        if (failingAccountId) {
          await updateAccounts(prev => prev.filter(acc => acc.userId !== failingAccountId));
        }

        // Получаем список оставшихся аккаунтов
        const remainingAccounts = await (async () => {
          const accountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
          return parseAccounts(accountsRaw).filter(acc => acc.userId !== failingAccountId);
        })();

        // Если есть другие аккаунты, пытаемся переключиться на первый
        if (remainingAccounts.length > 0) {
          const fallbackAccount = remainingAccounts[0];
          console.log('[Auth] Attempting to switch to fallback account:', fallbackAccount.userId);
          
          // Проверяем, не обрабатываем ли мы уже этот аккаунт
          const fallbackKey = fallbackAccount.userId;
          if (handlingAuthFailure.current.has(fallbackKey)) {
            console.warn('[Auth] Fallback account is already being handled, clearing session');
            await persistActiveAccount(null);
            await clearSession();
            return false;
          }
          
          await persistActiveAccount(fallbackAccount.userId);
          await setSession({
            accessToken: fallbackAccount.accessToken,
            refreshToken: fallbackAccount.refreshToken,
          });
          
          try {
            // Вызываем fetchProfile без автоматического refresh при ошибке
            // чтобы избежать рекурсии
            const profile = await apiRequest('/auth/me', {}, fallbackAccount.accessToken);
            const normalized = {
              ...profile,
              avatarUrl: normalizeMediaUrl(profile?.avatarUrl) ?? null,
            };
            setUser(normalized);
            await upsertAccount(normalized, { 
              accessToken: fallbackAccount.accessToken, 
              refreshToken: fallbackAccount.refreshToken 
            });
            console.log('[Auth] Successfully switched to fallback account');
            handlingAuthFailure.current.delete(failureKey);
            return true;
          } catch (error: any) {
            console.warn('[Auth] Failed to hydrate fallback account profile', error);
            
            // Если ошибка 401 и есть refresh token, пытаемся обновить
            // Но только если это не сетьевая ошибка
            const isNetworkError = error?.message?.includes('Network request failed') || 
                                   error?.message?.includes('Failed to fetch');
            
            if (!isNetworkError && (error?.status === 401 || error?.status === 403) && fallbackAccount.refreshToken && fallbackAccount.refreshToken.trim() !== '') {
              try {
                await refreshSession(fallbackAccount.refreshToken);
                // После обновления токена повторяем fetchProfile
                const updatedAccountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
                const updatedAccounts = parseAccounts(updatedAccountsRaw);
                const updatedFallback = updatedAccounts.find(acc => acc.userId === fallbackAccount.userId);
                if (updatedFallback?.accessToken) {
                  const profile = await apiRequest('/auth/me', {}, updatedFallback.accessToken);
                  const normalized = {
                    ...profile,
                    avatarUrl: normalizeMediaUrl(profile?.avatarUrl) ?? null,
                  };
                  setUser(normalized);
                  await upsertAccount(normalized, { 
                    accessToken: updatedFallback.accessToken, 
                    refreshToken: updatedFallback.refreshToken 
                  });
                  console.log('[Auth] Successfully switched to fallback account after refresh');
                  handlingAuthFailure.current.delete(failureKey);
                  return true;
                }
              } catch (refreshError) {
                console.warn('[Auth] Failed to refresh fallback account token', refreshError);
                // Не вызываем handleAccountAuthFailure рекурсивно
              }
            }
            
            // Если fallback аккаунт тоже невалиден, НЕ рекурсивно обрабатываем его
            // чтобы избежать зацикливания - просто очищаем сессию
            console.warn('[Auth] Fallback account is invalid, clearing session');
            await persistActiveAccount(null);
            await clearSession();
            handlingAuthFailure.current.delete(failureKey);
            return false;
          }
        }

        // Если других аккаунтов нет, полностью очищаем сессию
        console.log('[Auth] No valid accounts remaining, clearing session');
        await persistActiveAccount(null);
        await clearSession();
        handlingAuthFailure.current.delete(failureKey);
        return false;
      } finally {
        // Убеждаемся, что удаляем ключ даже при ошибке
        handlingAuthFailure.current.delete(failureKey);
      }
    },
    [updateAccounts, persistActiveAccount, setSession, upsertAccount, clearSession, secureStorageAvailable, refreshSession, normalizeMediaUrl],
  );

  const refreshSession = useCallback(
    async (token?: string) => {
      const refreshTokenToUse = token ?? refreshToken;
      // Проверяем, что токен существует и не является пустой строкой
      if (!refreshTokenToUse || refreshTokenToUse.trim() === '') {
        console.warn('[Auth] Cannot refresh session: no valid refresh token');
        return;
      }
      
      // Защита от повторных вызовов с тем же токеном
      const refreshKey = `${refreshTokenToUse.substring(0, 20)}`;
      if (refreshingTokens.current.has(refreshKey)) {
        console.log('[Auth] Refresh already in progress for this token, skipping');
        return;
      }
      
      refreshingTokens.current.add(refreshKey);
      
      try {
        const data = await apiRequest(
          '/auth/refresh',
          {
            method: 'POST',
            body: JSON.stringify({ refreshToken: refreshTokenToUse }),
          },
          null,
        );
        await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        if (data.user) {
          setUser(data.user);
          await upsertAccount(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } else {
          await fetchProfile(data.accessToken);
        }
      } catch (error) {
        // Не логируем как ERROR, если это ожидаемая ошибка (Invalid refresh token)
        const isAuthError =
          error instanceof ApiError
            ? error.status === 401 || error.status === 403
            : (error as any)?.message?.toLowerCase?.().includes('invalid refresh');
        
        const isNetworkError = 
          (error as any)?.message?.toLowerCase?.().includes('network request failed') ||
          (error as any)?.message?.toLowerCase?.().includes('failed to fetch');

        if (isNetworkError) {
          // При сетевой ошибке не пытаемся обновлять токен бесконечно
          console.warn('[Auth] Network error, stopping refresh attempts');
          refreshingTokens.current.delete(refreshKey);
          await clearSession();
          return;
        }

        if (isAuthError) {
          // При ошибке авторизации (Invalid refresh token) обрабатываем через handleAccountAuthFailure
          // Это попытается переключиться на другой аккаунт или очистит сессию
          console.warn('[Auth] Invalid refresh token, handling account auth failure');
          refreshingTokens.current.delete(refreshKey);
          const switched = await handleAccountAuthFailure(activeAccountId ?? null);
          if (!switched) {
            // Если не удалось переключиться на другой аккаунт, сессия уже очищена
            console.log('[Auth] Session cleared after auth failure');
          }
          return;
        }

        // Для других ошибок просто очищаем сессию
        console.warn('[Auth] Unknown error during refresh, clearing session', error);
        refreshingTokens.current.delete(refreshKey);
        await clearSession();
      } finally {
        refreshingTokens.current.delete(refreshKey);
      }
    },
    [
      refreshToken,
      setSession,
      fetchProfile,
      upsertAccount,
      activeAccountId,
      handleAccountAuthFailure,
      clearSession,
    ],
  );

  const bootstrapSession = useCallback(async () => {
    try {
      const [accountsRaw, activeIdRaw, storedAccess, storedRefresh] = await Promise.all([
        storageGet(ACCOUNTS_KEY, secureStorageAvailable),
        storageGet(ACTIVE_ACCOUNT_KEY, secureStorageAvailable),
        storageGet(ACCESS_TOKEN_KEY, secureStorageAvailable),
        storageGet(REFRESH_TOKEN_KEY, secureStorageAvailable),
      ]);

      const parsedAccounts = parseAccounts(accountsRaw);
      
      // КРИТИЧЕСКИ ВАЖНО: Объединяем аккаунты из storage с аккаунтами из состояния
      // Но делаем это синхронно, без вызова updateAccounts (который теперь async)
      let mergedAccounts: StoredAccount[] = [];
      if (parsedAccounts.length > 0) {
        // Если в storage есть аккаунты, объединяем их с аккаунтами из текущей сессии
        const storageAccountIds = new Set(parsedAccounts.map(acc => acc.userId));
        const sessionAccounts = accounts.filter(acc => !storageAccountIds.has(acc.userId));
        mergedAccounts = [...parsedAccounts, ...sessionAccounts];
        console.log('[Auth] bootstrapSession: загружено из storage:', parsedAccounts.length, 'из сессии:', sessionAccounts.length, 'всего:', mergedAccounts.length);
      } else {
        // Если в storage нет аккаунтов, используем аккаунты из текущей сессии
        mergedAccounts = accounts.length > 0 ? accounts : parsedAccounts;
      }
      
      // Сохраняем объединенные аккаунты в storage и состояние
      if (mergedAccounts.length > 0) {
        await storageSet(ACCOUNTS_KEY, JSON.stringify(mergedAccounts), secureStorageAvailable);
        setAccounts(mergedAccounts);
      }
      
      // Используем mergedAccounts для дальнейшей работы
      let targetAccountId = activeIdRaw;
      if (!targetAccountId || !mergedAccounts.some(acc => acc.userId === targetAccountId)) {
        targetAccountId = mergedAccounts.length > 0 ? mergedAccounts[0].userId : null;
      }
      
      if (targetAccountId) {
        await persistActiveAccount(targetAccountId);
      }

      const targetAccount =
        (targetAccountId && mergedAccounts.find(acc => acc.userId === targetAccountId)) ?? mergedAccounts[0] ?? null;

      if (targetAccount) {
        await setSession({ accessToken: targetAccount.accessToken, refreshToken: targetAccount.refreshToken });
        try {
          await fetchProfile(targetAccount.accessToken);
        } catch (error: any) {
          const isNetworkError = error?.message?.includes('Network request failed') || 
                                 error?.message?.includes('Failed to fetch');
          
          if (isNetworkError) {
            // При сетевой ошибке не пытаемся обновлять токен
            console.warn('[Auth] Network error during profile fetch, using cached user data');
            setUser({
              id: targetAccount.userId,
              email: targetAccount.email,
              username: targetAccount.username,
              name: targetAccount.name,
              avatarUrl: targetAccount.avatarUrl,
            });
          } else if (error?.status === 401 && targetAccount.refreshToken && targetAccount.refreshToken.trim() !== '') {
            // Пытаемся обновить токен, но если это тоже невалидный refresh token, handleAccountAuthFailure обработает это
            try {
              await refreshSession(targetAccount.refreshToken);
            } catch (refreshError: any) {
              // Если refresh тоже не удался, обрабатываем через handleAccountAuthFailure
              if (refreshError?.status === 401 || refreshError?.status === 403 || 
                  refreshError?.message?.toLowerCase?.().includes('invalid refresh')) {
                await handleAccountAuthFailure(targetAccount.userId);
              } else {
                console.warn('[Auth] Failed to restore account session after refresh attempt', refreshError);
                await clearSession();
              }
            }
          } else {
            console.warn('[Auth] Failed to restore account session', error);
            // Если это не 401 ошибка, просто очищаем сессию
            await clearSession();
          }
        }
        return;
      }

      if (storedAccess) {
        await setSession({ accessToken: storedAccess, refreshToken: storedRefresh ?? undefined });
        try {
          await fetchProfile(storedAccess);
        } catch (error: any) {
          const isNetworkError = error?.message?.includes('Network request failed') || 
                                 error?.message?.includes('Failed to fetch');
          
          if (isNetworkError) {
            // При сетевой ошибке не пытаемся обновлять токен
            console.warn('[Auth] Offline mode: session restored without profile');
          } else if (error?.status === 401 && storedRefresh && storedRefresh.trim() !== '') {
            // Пытаемся обновить токен, но если это тоже невалидный refresh token, очищаем сессию
            try {
              await refreshSession(storedRefresh);
            } catch (refreshError: any) {
              // Если refresh тоже не удался, просто очищаем сессию (legacy session не имеет accountId)
              if (refreshError?.status === 401 || refreshError?.status === 403 || 
                  refreshError?.message?.toLowerCase?.().includes('invalid refresh')) {
                console.warn('[Auth] Invalid refresh token for legacy session, clearing');
                await clearSession();
              } else {
                console.warn('[Auth] Failed to restore legacy session after refresh attempt', refreshError);
                await clearSession();
              }
            }
          } else {
            console.warn('[Auth] Failed to restore legacy session', error);
            await clearSession();
          }
        }
      }
    } finally {
      setInitializing(false);
    }
  }, [secureStorageAvailable, setSession, fetchProfile, refreshSession, clearSession, persistActiveAccount, handleAccountAuthFailure]);

  const hasBootstrapped = useRef(false);
  const refreshingTokens = useRef<Set<string>>(new Set()); // Защита от повторных вызовов refreshSession
  const handlingAuthFailure = useRef<Set<string>>(new Set()); // Защита от рекурсивных вызовов handleAccountAuthFailure
  
  useEffect(() => {
    // Защита от повторных вызовов bootstrapSession
    if (hasBootstrapped.current) {
      console.log('[Auth] bootstrapSession уже был вызван, пропускаем');
      return;
    }
    
    (async () => {
      try {
        const available = await SecureStore.isAvailableAsync();
        setSecureStorageAvailable(!!available);
      } catch (error) {
        console.warn('[Auth] SecureStore unavailable, falling back to localStorage');
        setSecureStorageAvailable(false);
      }
      hasBootstrapped.current = true;
      await bootstrapSession();
    })();
  }, [bootstrapSession]);

  useEffect(() => {
    console.log('[Auth] state', {
      initializing,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasUser: Boolean(user),
      accountCount: accounts.length,
      activeAccountId,
    });
  }, [initializing, accessToken, refreshToken, user, accounts.length, activeAccountId]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const data = await apiRequest(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
          null,
        );
        
        console.log('[Auth] login: получены данные', { userId: data.user?.id, hasTokens: !!data.accessToken });
        
        // КРИТИЧЕСКИ ВАЖНО: Сначала сохраняем аккаунт и устанавливаем активный аккаунт
        // Потом устанавливаем сессию, чтобы токены соответствовали активному аккаунту
        if (data.user) {
          setUser(data.user);
          // Сохраняем аккаунт в storage
          await upsertAccount(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          // Явно устанавливаем активный аккаунт ПЕРЕД установкой сессии
          await persistActiveAccount(data.user.id);
          console.log('[Auth] login: активный аккаунт установлен на', data.user.id);
          // Теперь устанавливаем сессию с токенами нового аккаунта
          await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        } else {
          const profile = await fetchProfile(data.accessToken);
          if (profile?.id) {
            // Если профиль загружен, сохраняем аккаунт и переключаемся на него
            await upsertAccount(profile, {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            });
            await persistActiveAccount(profile.id);
            console.log('[Auth] login: активный аккаунт установлен на', profile.id);
            await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          } else {
            // Если профиль не загружен, все равно устанавливаем сессию
            await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [setSession, upsertAccount, fetchProfile, persistActiveAccount],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      setLoading(true);
      try {
        const data = await apiRequest(
          '/auth/google',
          {
            method: 'POST',
            body: JSON.stringify({ idToken }),
          },
          null,
        );
        await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        if (data.user) {
          setUser(data.user);
          await upsertAccount(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } else {
          await fetchProfile(data.accessToken);
        }
      } finally {
        setLoading(false);
      }
    },
    [setSession, upsertAccount, fetchProfile],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await apiRequest(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        null,
      );

      // КРИТИЧЕСКИ ВАЖНО: Если требуется подтверждение email, НЕ устанавливаем сессию
      // Токены будут выданы только после подтверждения email при логине
      if (data?.requiresEmailVerification) {
        // Возвращаем данные без установки сессии
        // Клиент должен перенаправить на экран подтверждения email
        return data;
      }

      // Если токены вернулись (что не должно происходить при правильной настройке)
      if (data?.accessToken) {
        await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        if (data.user) {
          setUser(data.user);
          await upsertAccount(data.user, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        } else {
          await fetchProfile(data.accessToken);
        }
      }

      return data;
    },
    [setSession, upsertAccount, fetchProfile],
  );

  const verifyEmail = useCallback(async (token: string) => {
    const data = await apiRequest(
      '/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      },
      null,
    );
    
    // КРИТИЧЕСКИ ВАЖНО: Если сервер вернул токены после верификации, устанавливаем сессию
    if (data?.accessToken && data?.user) {
      console.log('[Auth] verifyEmail: получены токены, устанавливаем сессию для пользователя', data.user.id);
      await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setUser(data.user);
      // Сохраняем аккаунт и устанавливаем активный аккаунт
      await upsertAccount(data.user, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      await persistActiveAccount(data.user.id);
      console.log('[Auth] verifyEmail: сессия установлена, активный аккаунт:', data.user.id);
    }
    
    return data;
  }, [setSession, upsertAccount, persistActiveAccount]);

  const resendVerificationEmail = useCallback(async (email: string) => {
    return apiRequest(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      null,
    );
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await apiRequest(
      '/auth/request-password-reset',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      null,
    );
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await apiRequest(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      },
      null,
    );
  }, []);

  const switchAccount = useCallback(
    async (userId: string) => {
      if (userId === activeAccountId) return;
      
      // Получаем актуальный список аккаунтов из хранилища
      const accountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
      const parsedAccounts = parseAccounts(accountsRaw);
      const target = parsedAccounts.find(acc => acc.userId === userId);
      
      if (!target) {
        console.warn('[Auth] Account not found for switch:', userId);
        return;
      }
      
      // Устанавливаем сессию и активный аккаунт синхронно
      await setSession({ accessToken: target.accessToken, refreshToken: target.refreshToken });
      await persistActiveAccount(userId);
      
      // Даем React время обновить состояние токена перед продолжением
      // Это важно, чтобы EventsContext получил новый токен
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        await fetchProfile(target.accessToken);
      } catch (error: any) {
        console.warn('[Auth] Failed to fetch profile after switching account', error);
        // Если ошибка 401 и есть refresh token, пытаемся обновить
        if ((error?.status === 401 || error?.status === 403) && target.refreshToken && target.refreshToken.trim() !== '') {
          try {
            await refreshSession(target.refreshToken);
            // После обновления токена повторяем fetchProfile
            const updatedAccountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
            const updatedAccounts = parseAccounts(updatedAccountsRaw);
            const updatedTarget = updatedAccounts.find(acc => acc.userId === userId);
            if (updatedTarget?.accessToken) {
              await fetchProfile(updatedTarget.accessToken);
            }
          } catch (refreshError) {
            console.warn('[Auth] Failed to refresh token after switch, account may be invalid', refreshError);
            // Не вызываем handleAccountAuthFailure здесь, чтобы избежать зацикливания
          }
        }
      }
    },
    [activeAccountId, setSession, persistActiveAccount, fetchProfile, refreshSession, secureStorageAvailable],
  );

  const removeAccount = useCallback(
    async (userId: string) => {
      const target = accounts.find(acc => acc.userId === userId);
      if (!target) return;
      let nextAccount: StoredAccount | undefined;
      await updateAccounts(prev => {
        const filtered = prev.filter(acc => acc.userId !== userId);
        nextAccount = filtered[0];
        return filtered;
      });
      if (userId === activeAccountId) {
        if (nextAccount) {
          await persistActiveAccount(nextAccount.userId);
          await setSession({ accessToken: nextAccount.accessToken, refreshToken: nextAccount.refreshToken });
          await fetchProfile(nextAccount.accessToken);
        } else {
          await persistActiveAccount(null);
          await clearSession();
        }
      }
    },
    [accounts, activeAccountId, updateAccounts, persistActiveAccount, setSession, fetchProfile, clearSession],
  );

  const logout = useCallback(async () => {
    // Получаем актуальный список аккаунтов из storage ПЕРЕД любыми операциями
    const accountsRaw = await storageGet(ACCOUNTS_KEY, secureStorageAvailable);
    const parsedAccounts = parseAccounts(accountsRaw);
    const currentAccountId = activeAccountId || user?.id;
    
    console.log('[Auth] logout: начало, аккаунтов в storage:', parsedAccounts.length, 'текущий:', currentAccountId);
    
    if (!currentAccountId) {
      await clearSession();
      await updateAccounts(() => []);
      await persistActiveAccount(null);
      return false;
    }

    if (accessToken) {
      try {
        await apiRequest('/auth/logout', { method: 'POST' }, accessToken);
      } catch (error) {
        console.warn('[Auth] Logout request failed', error);
      }
    }

    // ВАЖНО: Используем parsedAccounts из storage, а не prev из состояния
    // Это гарантирует, что мы работаем с актуальными данными
    const accountsToUse = parsedAccounts.length > 0 ? parsedAccounts : accounts;
    const filtered = accountsToUse.filter(acc => acc.userId !== currentAccountId);
    const nextAccount = filtered[0];
    
    console.log('[Auth] logout: удаление аккаунта', currentAccountId, 'из', accountsToUse.length, 'аккаунтов');
    console.log('[Auth] logout: осталось аккаунтов', filtered.length, 'следующий:', nextAccount?.userId);
    console.log('[Auth] logout: все аккаунты после фильтрации:', filtered.map(a => a.userId));

    // КРИТИЧЕСКИ ВАЖНО: updateAccounts теперь сам сохраняет в storage
    // и читает актуальные данные перед обновлением
    // skipWarning: true - это намеренное удаление аккаунта при logout, не нужно предупреждение
    await updateAccounts(() => filtered, { skipWarning: true });

    if (nextAccount) {
      await persistActiveAccount(nextAccount.userId);
      await setSession({ accessToken: nextAccount.accessToken, refreshToken: nextAccount.refreshToken });
      // ВАЖНО: Используем данные из nextAccount напрямую, без вызова upsertAccount
      // upsertAccount может перезаписать аккаунты из storage, что приведет к потере данных
      setUser({
        id: nextAccount.userId,
        email: nextAccount.email,
        username: nextAccount.username,
        name: nextAccount.name,
        avatarUrl: nextAccount.avatarUrl,
      });
      // НЕ вызываем upsertAccount здесь, так как это может перезаписать аккаунты
      // Вместо этого просто обновляем состояние пользователя
      return true;
    }

    await persistActiveAccount(null);
    await clearSession();
    return false;
  }, [activeAccountId, user?.id, accessToken, accounts, clearSession, updateAccounts, persistActiveAccount, setSession, setUser, secureStorageAvailable]);

  // Функция для проверки, является ли userId одним из сохраненных аккаунтов
  const isMyAccount = useCallback((userId: string | null | undefined): boolean => {
    if (!userId) return false;
    // Проверяем, есть ли userId в списке сохраненных аккаунтов
    return accounts.some(acc => acc.userId === userId);
  }, [accounts]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      accounts,
      activeAccountId,
      initializing,
      loading,
      isAuthenticated: Boolean(accessToken && user),
      refreshUser: () => fetchProfile(),
      login,
      loginWithGoogle,
      register,
      verifyEmail,
      resendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      logout,
      switchAccount,
      removeAccount,
      isMyAccount,
      refreshSession,
    }),
    [
      user,
      accessToken,
      refreshToken,
      accounts,
      activeAccountId,
      initializing,
      loading,
      fetchProfile,
      login,
      loginWithGoogle,
      register,
      verifyEmail,
      resendVerificationEmail,
      requestPasswordReset,
      resetPassword,
      logout,
      switchAccount,
      removeAccount,
      isMyAccount,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


