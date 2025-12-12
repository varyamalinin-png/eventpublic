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
    enabled: typeof __DEV__ !== 'undefined' ? __DEV__ : (process.env.NODE_ENV !== 'production'), // Включаем логи только в режиме разработки
    level: 'debug',
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

