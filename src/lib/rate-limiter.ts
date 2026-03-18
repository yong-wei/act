/**
 * 限流器
 *
 * 用于防止 API 过载和错误风暴
 * - 基于内存的滑动窗口限流
 * - 支持按用户、IP、端点限流
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  windowMs: number;
}

interface RateLimitOptions {
  windowMs: number;      // 时间窗口 (毫秒)
  maxRequests: number;   // 窗口内最大请求数
  blockDuration?: number; // 超限后封禁时长 (毫秒)
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private defaultOptions: RateLimitOptions = {
    windowMs: 60000,      // 1分钟
    maxRequests: 100,     // 100请求/分钟
    blockDuration: 60000, // 封禁1分钟
  }) {
    this.startCleanup();
  }

  /**
   * 检查是否允许请求
   */
  check(key: string, options?: Partial<RateLimitOptions>): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const opts = { ...this.defaultOptions, ...options };
    const now = Date.now();

    let entry = this.store.get(key);

    // 新条目或已过期的条目
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + opts.windowMs,
        windowMs: opts.windowMs,
      };
      this.store.set(key, entry);
      return {
        allowed: true,
        remaining: opts.maxRequests - 1,
        resetTime: entry.resetTime,
      };
    }

    // 检查是否被封禁
    if (entry.count < 0) {
      const retryAfter = entry.resetTime - now;
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // 检查是否超限
    if (entry.count >= opts.maxRequests) {
      // 封禁处理
      if (opts.blockDuration) {
        entry.count = -1;
        entry.resetTime = now + opts.blockDuration;
      }
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: opts.blockDuration ? Math.ceil(opts.blockDuration / 1000) : undefined,
      };
    }

    // 允许请求，计数增加
    entry.count++;
    return {
      allowed: true,
      remaining: opts.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * 消费一个请求配额
   */
  consume(key: string, options?: Partial<RateLimitOptions>): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    return this.check(key, options);
  }

  /**
   * 获取当前状态
   */
  getStatus(key: string): {
    count: number;
    resetTime: number;
    blocked: boolean;
  } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    return {
      count: Math.abs(entry.count),
      resetTime: entry.resetTime,
      blocked: entry.count < 0,
    };
  }

  /**
   * 重置特定 key
   */
  reset(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    });
  }

  /**
   * 启动定时清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 停止清理
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalKeys: number;
    blockedKeys: number;
  } {
    let blocked = 0;
    Array.from(this.store.values()).forEach((entry) => {
      if (entry.count < 0) blocked++;
    });
    return {
      totalKeys: this.store.size,
      blockedKeys: blocked,
    };
  }
}

// 全局限流器实例
export const rateLimiter = new RateLimiter();

// 课堂 API 专用限流器（更严格）
export const classroomRateLimiter = new RateLimiter({
  windowMs: 10000,      // 10秒
  maxRequests: 30,      // 30请求/10秒
  blockDuration: 30000, // 封禁30秒
});

// 事件上报限流器
export const eventRateLimiter = new RateLimiter({
  windowMs: 60000,      // 1分钟
  maxRequests: 200,     // 200请求/分钟
  blockDuration: 60000, // 封禁1分钟
});

// 类型导出
export type { RateLimitOptions };
export { RateLimiter };
