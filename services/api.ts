// Используем переменную окружения EXPO_PUBLIC_API_URL для подключения к серверу
// URL настраивается в файле client/.env или в app.json (для Release сборки)
import Constants from 'expo-constants';

// В Release сборке используем Constants.manifest?.extra, в Development - Constants.expoConfig?.extra
const apiUrlFromConstants = 
  Constants.manifest?.extra?.apiUrl || 
  Constants.expoConfig?.extra?.apiUrl;

const DEFAULT_API_URL =
  apiUrlFromConstants ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://iwent.ru/api';

// Детальное логирование API URL отключено (включить при отладке через EXPO_DEBUG_API=1)
const LOG_API_VERBOSE = typeof process !== 'undefined' && process.env?.EXPO_DEBUG_API === '1';
if (typeof __DEV__ !== 'undefined' && __DEV__ && LOG_API_VERBOSE) {
  console.log('[API] Using API URL:', DEFAULT_API_URL);
}

export const API_BASE_URL = DEFAULT_API_URL.replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(
  path: string,
  options: RequestInit = {},
  token?: string | null,
) {
  const headers: Record<string, string> = {};
  
  // Не устанавливаем Content-Type для FormData - браузер/React Native сделает это автоматически
  // Проверяем, является ли body FormData
  // В React Native FormData может быть не стандартным объектом, поэтому проверяем более надежно
  const isFormData = options.body instanceof FormData || 
                     (options.body && typeof options.body === 'object' && 'append' in options.body && typeof (options.body as any).append === 'function');
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  } else {
    // Для FormData удаляем Content-Type из пользовательских заголовков, если он там есть
    // Это важно, чтобы браузер/React Native мог установить правильный boundary
    if (options.headers) {
      const userHeaders = options.headers as Record<string, string>;
      if (userHeaders['Content-Type']) {
        delete userHeaders['Content-Type'];
      }
    }
  }
  
  // Добавляем пользовательские заголовки, если они есть
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Таймаут: для auth/refresh на мобильных даём больше времени (слабый сигнал/переключение сетей)
  const timeoutMs = path === '/auth/refresh' ? 60000 : 30000;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[API] Request timeout: ${API_BASE_URL}${path}`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry once on server errors (5xx)
      if (response.status >= 500 && attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const body = await parseResponse(response);

      if (!response.ok) {
        const message = typeof body === 'string' ? body : body?.message || 'API error';
        throw new ApiError(message, response.status, body);
      }

      return body;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Retry once on network errors (TypeError from fetch)
      if (attempt === 0 && error instanceof TypeError) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // Ожидаемые ошибки (400, 401, 403, 404) не логируем как ERROR
      if (error instanceof ApiError) {
        const isExpectedError = error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404;
        if (isExpectedError) {
          // Не логируем ожидаемые ошибки, они обрабатываются в вызывающем коде
          throw error;
        }
        console.warn(`[API] Request failed: ${API_BASE_URL}${path}`, error.status);
        throw error;
      }
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('Aborted')) {
        // Silent — network timeouts are expected on poor connections
        throw new ApiError('Network timeout', 0, null);
      }
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        throw new ApiError('No connection', 0, null);
      }
      throw error;
    }
  }
}
