type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'debug';

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [TRACE-${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: unknown): void {
    if (this.level === 'debug') {
      console.log(this.formatMessage('debug', message), data !== undefined ? data : '');
    }
  }

  info(message: string, data?: unknown): void {
    console.info(this.formatMessage('info', message), data !== undefined ? data : '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('warn', message), data !== undefined ? data : '');
  }

  error(message: string, error?: unknown): void {
    console.error(this.formatMessage('error', message), error !== undefined ? error : '');
  }
}

export const logger = new Logger();
