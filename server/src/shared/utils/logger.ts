/**
 * Централизованная система логирования для сервера
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
    enabled: process.env.NODE_ENV !== 'production' || process.env.ENABLE_LOGS === 'true',
    level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  };

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(prefix: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString();
    const messagePrefix = this.config.prefix 
      ? `[${timestamp}] [${this.config.prefix}] ${prefix}`
      : `[${timestamp}] ${prefix}`;
    return [messagePrefix, ...args];
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

