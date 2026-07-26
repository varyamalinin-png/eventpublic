/**
 * Централизованная система логирования
 * Позволяет легко включать/отключать логи и контролировать их уровень
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig = {
    enabled: typeof __DEV__ !== 'undefined' ? __DEV__ : (process.env.NODE_ENV !== 'production'),
    level: 'warn', // debug/info не выводятся в терминал; для отладки установите level: 'debug'
  };

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(prefix: string, ...args: any[]): any[] {
    return this.config.prefix 
      ? [`[${this.config.prefix}]`, prefix, ...args]
      : [prefix, ...args];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('🔵', ...args));
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('✅', ...args));
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('⚠️', ...args));
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      // Подавляем ошибки WebSocket - они не критичны, socket.io автоматически переподключается
      const errorString = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg?.message) return arg.message;
        if (arg?.toString) return arg.toString();
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }).join(' ');
      
      // Проверяем на различные варианты ошибок WebSocket
      const isWebSocketError = 
        errorString.includes('WebSocket connection error') || 
        errorString.includes('websocket error') ||
        errorString.includes('TransportError') ||
        errorString.includes('engine.io-client') ||
        errorString.includes('_construct') && errorString.includes('construct.js') ||
        (args[0] && typeof args[0] === 'object' && args[0]?.message?.includes('websocket'));
      
      if (isWebSocketError) {
        // Не выводим эти ошибки - они не критичны, socket.io автоматически переподключается
        return;
      }
      
      console.error(...this.formatMessage('❌', ...args));
    }
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  createLogger(prefix: string): Logger {
    const logger = new Logger();
    logger.setConfig({ ...this.config, prefix });
    return logger;
  }
}

// Экспортируем singleton экземпляр
export const logger = new Logger();

// Экспортируем функцию для создания именованных логгеров
export const createLogger = (prefix: string) => logger.createLogger(prefix);

