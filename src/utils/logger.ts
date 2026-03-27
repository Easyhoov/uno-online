/**
 * 统一日志系统
 * 
 * 提供分级日志、格式化输出、生产环境过滤
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 日志配置
 */
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  showTimestamp: boolean;
  showColors: boolean;
}

/**
 * 默认配置
 */
const defaultConfig: LoggerConfig = {
  level: import.meta.env.PROD ? LogLevel.INFO : LogLevel.DEBUG,
  prefix: 'UNO',
  showTimestamp: true,
  showColors: !import.meta.env.PROD
};

/**
 * 日志类
 */
class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel) {
    this.config.level = level;
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour12: false });
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, module: string, ...args: any[]): any[] {
    const parts: any[] = [];
    
    if (this.config.showTimestamp) {
      parts.push(`[${this.formatTimestamp()}]`);
    }
    
    parts.push(`[${this.config.prefix}]`);
    parts.push(`[${level}]`);
    
    if (module) {
      parts.push(`[${module}]`);
    }
    
    return [...parts, ...args];
  }

  /**
   * 检查是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  debug(module: string, ...args: any[]) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.log(...this.formatMessage('DBG', module, ...args));
  }

  info(module: string, ...args: any[]) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.info(...this.formatMessage('INF', module, ...args));
  }

  warn(module: string, ...args: any[]) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(...this.formatMessage('WRN', module, ...args));
  }

  error(module: string, ...args: any[]) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    console.error(...this.formatMessage('ERR', module, ...args));
  }

  /**
   * 记录游戏动作日志（用于调试/回放）
   */
  logAction(module: string, actionType: string, playerId: string, data?: any) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.log(
      ...this.formatMessage('ACT', module, `🎮 ${actionType}`, `player:${playerId}`, data || '')
    );
  }

  /**
   * 记录网络消息日志
   */
  logMessage(module: string, direction: 'TX' | 'RX', messageType: string, peerId?: string) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const arrow = direction === 'TX' ? '→' : '←';
    const peerInfo = peerId ? `peer:${peerId}` : '';
    console.log(
      ...this.formatMessage('NET', module, `${arrow} ${messageType}`, peerInfo)
    );
  }

  /**
   * 记录性能日志
   */
  logPerformance(module: string, operation: string, durationMs: number) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const color = durationMs > 100 ? '🔴' : durationMs > 50 ? '🟡' : '🟢';
    console.log(
      ...this.formatMessage('PERF', module, `${color} ${operation}`, `${durationMs.toFixed(2)}ms`)
    );
  }
}

/**
 * 创建模块日志器
 */
export function createLogger(module: string): Logger {
  return new Logger({ ...defaultConfig, prefix: `UNO:${module}` });
}

/**
 * 全局日志器实例
 */
export const logger = new Logger();

/**
 * 快捷日志函数
 */
export const log = {
  debug: (module: string, ...args: any[]) => logger.debug(module, ...args),
  info: (module: string, ...args: any[]) => logger.info(module, ...args),
  warn: (module: string, ...args: any[]) => logger.warn(module, ...args),
  error: (module: string, ...args: any[]) => logger.error(module, ...args),
  action: (module: string, actionType: string, playerId: string, data?: any) => 
    logger.logAction(module, actionType, playerId, data),
  net: (module: string, direction: 'TX' | 'RX', messageType: string, peerId?: string) => 
    logger.logMessage(module, direction, messageType, peerId),
  perf: (module: string, operation: string, durationMs: number) => 
    logger.logPerformance(module, operation, durationMs)
};

// 导出 LogLevel 供外部使用
export { LogLevel };
