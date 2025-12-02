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
  'http://localhost:4000';

// Детальное логирование для отладки
console.log('[API] ==========================================');
console.log('[API] Using API URL:', DEFAULT_API_URL);
console.log('[API] From Constants.manifest?.extra?.apiUrl:', Constants.manifest?.extra?.apiUrl);
console.log('[API] From Constants.expoConfig?.extra?.apiUrl:', Constants.expoConfig?.extra?.apiUrl);
console.log('[API] From process.env.EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
console.log('[API] Constants.manifest?.extra:', JSON.stringify(Constants.manifest?.extra, null, 2));
console.log('[API] Constants.expoConfig?.extra:', JSON.stringify(Constants.expoConfig?.extra, null, 2));
console.log('[API] ==========================================');

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Увеличиваем таймаут для сетевых запросов
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[API] Request timeout: ${API_BASE_URL}${path}`);
    controller.abort();
  }, 30000); // 30 секунд

  try {
    console.log(`[API] Making request to: ${API_BASE_URL}${path}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[API] Response status: ${response.status} for ${path}`);

    const body = await parseResponse(response);

    if (!response.ok) {
      const message = typeof body === 'string' ? body : body?.message || 'API error';
      throw new ApiError(message, response.status, body);
    }

    return body;
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Ожидаемые ошибки (400, 401, 403, 404) не логируем как ERROR
    if (error instanceof ApiError) {
      const isExpectedError = error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404;
      if (isExpectedError) {
        // Не логируем ожидаемые ошибки, они обрабатываются в вызывающем коде
        throw error;
      }
      console.error(`[API] Request failed: ${API_BASE_URL}${path}`, error);
      throw error;
    }
    console.error(`[API] Request failed: ${API_BASE_URL}${path}`, error);
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      throw new Error('Network request timed out');
    }
    if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      throw new Error(`Cannot connect to server at ${API_BASE_URL}. Please check your network connection.`);
    }
    throw error;
  }
}
