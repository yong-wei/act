/**
 * LRU (Least Recently Used) 缓存实现
 *
 * 用于缓存高频访问数据，减少数据库查询压力
 * - 最大条目数限制 (maxSize)
 * - TTL 过期时间 (ttlMs)
 * - 自动清理过期条目
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

interface LRUCacheOptions {
  maxSize?: number;      // 最大缓存条目数 (默认100)
  ttlMs?: number;        // 过期时间毫秒 (默认60000 = 60s)
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;

  constructor(options: LRUCacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = options.ttlMs ?? 60000;
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新最后访问时间
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    // 如果缓存已满，删除最久未使用的条目
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      lastAccessed: now,
    });
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  /**
   * 检查key是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * 删除最久未使用的条目
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    });
  }
}

/**
 * 并发请求合并工具
 *
 * 用于合并同一key的并发请求，避免重复查询
 */
export class RequestDeduplicator<T> {
  private pendingRequests: Map<string, Promise<T>>;

  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * 执行请求，自动合并相同key的并发请求
   */
  async execute(key: string, requestFn: () => Promise<T>): Promise<T> {
    // 检查是否已有进行中的请求
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // 创建新请求
    const requestPromise = requestFn().finally(() => {
      // 请求完成后清理
      this.pendingRequests.delete(key);
    });

    // 记录进行中的请求
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * 检查是否有进行中的请求
   */
  hasPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  /**
   * 获取进行中请求的数量
   */
  pendingCount(): number {
    return this.pendingRequests.size;
  }
}

// 全局缓存实例 (Session缓存: 100条目, 60秒TTL)
export const sessionProfileCache = new LRUCache<{
  studentNumber: string | null;
  classId: string | null;
  techScore: number;
  ethicsScore: number;
  major: string | null;
  className: string | null;
}>({
  maxSize: 100,
  ttlMs: 60000, // 60秒
});

// 全局请求去重器
export const sessionRequestDeduplicator = new RequestDeduplicator<{
  studentNumber: string | null;
  classId: string | null;
  techScore: number;
  ethicsScore: number;
  major: string | null;
  className: string | null;
} | null>();
