import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { createLogger } from '../utils/logger';

const logger = createLogger('WebSocket');

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

// Функция для декодирования JWT токена без проверки подписи (только для проверки exp)
function decodeJWT(token: string): { exp?: number; [key: string]: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    return null;
  }
}

// Функция для проверки, не истек ли токен
function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  // Проверяем с запасом в 60 секунд, чтобы обновить токен до истечения
  const expirationTime = decoded.exp * 1000; // exp в секундах, конвертируем в миллисекунды
  const now = Date.now();
  return now >= (expirationTime - 60000); // 60 секунд запаса
}

export function createSocketConnection(token: string, refreshTokenCallback?: () => Promise<string | null>): Socket | null {
  // Проверяем, не истек ли токен
  if (isTokenExpired(token)) {
    logger.warn('Token expired, attempting to refresh...');
    if (refreshTokenCallback) {
      // Пытаемся обновить токен перед подключением
      refreshTokenCallback().then(newToken => {
        // Если refreshTokenCallback вернул null, это означает, что токен обновляется
        // через AuthContext, и useEffect перезапустится с новым токеном
        // В этом случае не создаем подключение здесь
        if (newToken) {
          // Переподключаемся с новым токеном
          if (socket) {
            socket.disconnect();
            socket = null;
          }
          createSocketConnection(newToken, refreshTokenCallback);
        } else {
          logger.debug('Token refresh initiated, waiting for new token from AuthContext');
          // Не создаем подключение с истекшим токеном
          // useEffect перезапустится с новым токеном после обновления
        }
      }).catch(error => {
        logger.warn('Error refreshing token:', error);
      });
      // Если токен истек и мы пытаемся обновить, отключаем существующий сокет и возвращаем null
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return null;
    } else {
      logger.warn('Token expired and no refresh callback provided');
      // Не создаем подключение с истекшим токеном
      // Отключаем существующий сокет, если он есть
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return null;
    }
  }

  // Если сокет уже подключен с тем же токеном, возвращаем его
  // Но если токен изменился, нужно переподключиться
  if (socket?.connected) {
    // Проверяем токен в auth
    const currentToken = (socket as any).auth?.token;
    if (currentToken === token) {
      // Токен совпадает - просто возвращаем существующий сокет
      // Обработчики уже добавлены, не нужно их добавлять повторно
      return socket;
    }
    // Токен изменился - отключаем и переподключаемся
    socket.removeAllListeners(); // Удаляем все обработчики
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }

  // Закрываем старое подключение, если есть
  if (socket && !socket.connected) {
    socket.removeAllListeners(); // Удаляем все обработчики
    socket.disconnect();
    socket = null;
  }

  // Формируем WebSocket URL из API URL
  let wsUrl = API_BASE_URL;
  // Если URL начинается с http://, заменяем на ws://
  // Если https://, заменяем на wss://
  if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  } else if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  } else {
    // Если нет протокола, добавляем ws://
    wsUrl = `ws://${wsUrl}`;
  }
  
  // Подключаемся к общему WebSocket namespace для всех real-time событий
  socket = io(`${wsUrl}/ws`, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Добавляем обработчики событий подключения
  // socket.io-client создает новый экземпляр при каждом вызове io(), 
  // поэтому обработчики нужно добавлять каждый раз
  socket.on('connect', () => {
    logger.info('WebSocket connected');
    reconnectAttempts = 0; // Сбрасываем счетчик при успешном подключении
  });

  socket.on('disconnect', (reason) => {
    logger.info('WebSocket disconnected', { reason });
    // Если отключение из-за истечения токена, пытаемся обновить токен и переподключиться
    if (reason === 'io server disconnect' || reason === 'transport close') {
      // Проверяем, не истек ли токен
      if (isTokenExpired(token)) {
        logger.warn('Disconnected due to expired token, attempting to refresh...');
        if (refreshTokenCallback) {
          refreshTokenCallback().then(newToken => {
            if (newToken && !isTokenExpired(newToken)) {
              // Переподключаемся с новым токеном
              logger.info('Token refreshed, reconnecting...');
              reconnectAttempts = 0;
              createSocketConnection(newToken, refreshTokenCallback);
            } else {
              logger.warn('Failed to refresh token or new token is also expired');
              socket = null;
            }
          }).catch(error => {
            console.warn('⚠️ WebSocket: Error refreshing token on disconnect:', error);
            socket = null;
          });
        } else {
          socket = null;
        }
      } else {
        // Если токен не истек, но сервер отключил - возможно, другая причина
        // Не очищаем socket, чтобы socket.io мог переподключиться автоматически
      }
    }
  });

  socket.on('connect_error', (error: any) => {
    // Проверяем, не связана ли ошибка с истекшим токеном
    const isTokenError = error?.message?.includes('jwt expired') || 
                         error?.message?.includes('TokenExpiredError') ||
                         error?.message?.includes('token expired') ||
                         error?.data?.type === 'TokenExpiredError' ||
                         error?.data?.message?.includes('token expired');
    
    if (isTokenError) {
      reconnectAttempts++;
      console.warn(`⚠️ WebSocket connection error: token expired (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      
      // Если есть callback для обновления токена, пытаемся обновить
      if (refreshTokenCallback && reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        // Отключаем текущий сокет перед обновлением токена
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
          socket = null;
        }
        
        refreshTokenCallback().then(newToken => {
          if (newToken && !isTokenExpired(newToken)) {
            // Переподключаемся с новым токеном
            console.log('✅ WebSocket: Token refreshed, reconnecting...');
            reconnectAttempts = 0;
            createSocketConnection(newToken, refreshTokenCallback);
          } else {
            console.warn('⚠️ WebSocket: Failed to refresh token or new token is also expired');
          }
        }).catch(refreshError => {
          console.warn('⚠️ WebSocket: Error refreshing token:', refreshError);
        });
      } else {
        console.warn('⚠️ WebSocket: Max reconnect attempts reached or no refresh callback');
      }
    } else {
      console.error('❌ WebSocket connection error:', error);
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

