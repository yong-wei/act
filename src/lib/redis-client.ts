/**
 * Redis 客户端
 *
 * 用于课堂状态的快速读写，减少 PostgreSQL 压力
 * - 当前页、当前步骤状态
 * - 在线人数统计
 * - 临时会话数据
 */

import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  private connect(): Redis | null {
    if (this.client) {
      return this.client;
    }

    try {
      this.client = new Redis(REDIS_URL, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('[Redis] Connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[Redis] Failed to connect:', error);
      this.client = null;
    }

    return this.client;
  }

  getClient(): Redis | null {
    return this.connect();
  }

  isReady(): boolean {
    const client = this.getClient();
    return this.isConnected && client?.status === 'ready';
  }

  /**
   * 课堂会话状态键
   */
  private sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * 获取课堂状态
   */
  async getSessionState(sessionId: string): Promise<{
    currentItemId?: string | null;
    currentStage?: string | null;
    updatedAt?: number;
    [key: string]: unknown;
  } | null> {
    if (!this.isReady()) return null;

    try {
      const data = await this.client!.hgetall(this.sessionKey(sessionId));
      if (!data || Object.keys(data).length === 0) return null;

      return {
        currentItemId: data.currentItemId || undefined,
        currentStage: data.currentStage || undefined,
        updatedAt: data.updatedAt ? parseInt(data.updatedAt, 10) : undefined,
        ...data,
      };
    } catch (error) {
      console.error('[Redis] getSessionState error:', error);
      return null;
    }
  }

  /**
   * 更新课堂状态
   */
  async setSessionState(
    sessionId: string,
    state: {
      currentItemId?: string | null;
      currentStage?: string | null;
      [key: string]: unknown;
    },
    ttlSeconds = 3600 // 默认1小时过期
  ): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const key = this.sessionKey(sessionId);
      const data = {
        ...state,
        updatedAt: Date.now().toString(),
      };

      await this.client!.hmset(key, data);
      await this.client!.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Redis] setSessionState error:', error);
      return false;
    }
  }

  /**
   * 更新特定字段
   */
  async updateSessionField(
    sessionId: string,
    field: string,
    value: string,
    ttlSeconds = 3600
  ): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const key = this.sessionKey(sessionId);
      await this.client!.hset(key, field, value);
      await this.client!.hset(key, 'updatedAt', Date.now().toString());
      await this.client!.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Redis] updateSessionField error:', error);
      return false;
    }
  }

  /**
   * 学生在线状态键
   */
  private presenceKey(sessionId: string): string {
    return `presence:${sessionId}`;
  }

  /**
   * 标记学生在线
   */
  async markStudentPresent(
    sessionId: string,
    userId: string,
    ttlSeconds = 60
  ): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const key = this.presenceKey(sessionId);
      await this.client!.zadd(key, Date.now(), userId);
      await this.client!.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Redis] markStudentPresent error:', error);
      return false;
    }
  }

  /**
   * 获取在线学生数
   */
  async getOnlineCount(sessionId: string, windowMs = 60000): Promise<number> {
    if (!this.isReady()) return 0;

    try {
      const key = this.presenceKey(sessionId);
      const cutoff = Date.now() - windowMs;
      // 清理过期条目
      await this.client!.zremrangebyscore(key, 0, cutoff);
      // 获取当前在线数
      const count = await this.client!.zcard(key);
      return count;
    } catch (error) {
      console.error('[Redis] getOnlineCount error:', error);
      return 0;
    }
  }

  /**
   * 获取在线学生列表
   */
  async getOnlineStudents(sessionId: string, windowMs = 60000): Promise<string[]> {
    if (!this.isReady()) return [];

    try {
      const key = this.presenceKey(sessionId);
      const cutoff = Date.now() - windowMs;
      await this.client!.zremrangebyscore(key, 0, cutoff);
      const students = await this.client!.zrange(key, 0, -1);
      return students;
    } catch (error) {
      console.error('[Redis] getOnlineStudents error:', error);
      return [];
    }
  }

  /**
   * 发布订阅频道
   */
  private channelKey(sessionId: string): string {
    return `channel:session:${sessionId}`;
  }

  /**
   * 发布状态变更
   */
  async publishStateChange(
    sessionId: string,
    message: {
      type: string;
      data: unknown;
      timestamp: number;
    }
  ): Promise<number> {
    if (!this.isReady()) return 0;

    try {
      const channel = this.channelKey(sessionId);
      const payload = JSON.stringify(message);
      return await this.client!.publish(channel, payload);
    } catch (error) {
      console.error('[Redis] publishStateChange error:', error);
      return 0;
    }
  }

  /**
   * 删除会话数据
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      await this.client!.del(this.sessionKey(sessionId));
      await this.client!.del(this.presenceKey(sessionId));
      return true;
    } catch (error) {
      console.error('[Redis] deleteSession error:', error);
      return false;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      await this.client!.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 优雅关闭
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }
}

// 全局单例
export const redisClient = new RedisClient();

// 类型导出
export type { Redis };
