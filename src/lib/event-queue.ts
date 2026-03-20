/**
 * 异步事件队列
 *
 * 用于批量处理课堂互动事件，减少对数据库的直接压力
 * - 事件先入队，立即返回成功
 * - 后台定时批量落库 (默认3秒)
 * - 落库失败只记警告，不影响用户体验
 */

import { prisma } from './prisma';

export interface QueuedEvent {
  userId: string;
  resourceId: string | null;
  resourceKey: string;
  sessionId: string | null;
  lessonKey: string | null;
  stepId: string | null;
  actorRole: string | null;
  attemptKey: string | null;
  eventType: string;
  eventData: Record<string, unknown>;
  clientEventAt: Date | null;
}

interface QueueStats {
  queued: number;
  processed: number;
  failed: number;
  lastFlushTime: number;
}

class EventQueue {
  private queue: QueuedEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs: number;
  private readonly batchSize: number;
  private stats: QueueStats = {
    queued: 0,
    processed: 0,
    failed: 0,
    lastFlushTime: Date.now(),
  };
  private isProcessing = false;

  constructor(options: { flushIntervalMs?: number; batchSize?: number } = {}) {
    this.flushIntervalMs = options.flushIntervalMs ?? 3000; // 默认3秒
    this.batchSize = options.batchSize ?? 100; // 每批最多100条
    this.startTimer();
  }

  /**
   * 添加事件到队列
   */
  enqueue(event: QueuedEvent): void {
    this.queue.push(event);
    this.stats.queued++;

    // 如果队列过长，立即触发刷新
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * 批量添加事件
   */
  enqueueBatch(events: QueuedEvent[]): void {
    this.queue.push(...events);
    this.stats.queued += events.length;

    // 如果队列过长，立即触发刷新
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * 立即刷新队列到数据库
   */
  async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // 取出当前队列中的所有事件
    const eventsToProcess = this.queue.splice(0, this.batchSize);

    try {
      // 批量插入数据库
      const result = await prisma.interactionLog.createMany({
        data: eventsToProcess.map((event) => ({
          userId: event.userId,
          resourceId: event.resourceId,
          resourceKey: event.resourceKey,
          sessionId: event.sessionId,
          lessonKey: event.lessonKey,
          stepId: event.stepId,
          actorRole: event.actorRole,
          attemptKey: event.attemptKey,
          eventType: event.eventType,
          eventData: event.eventData as unknown as import('@prisma/client').Prisma.InputJsonValue,
          clientEventAt: event.clientEventAt,
        })),
        skipDuplicates: true,
      });

      this.stats.processed += result.count;
      this.stats.lastFlushTime = Date.now();

      // 如果还有更多事件，继续处理
      if (this.queue.length > 0) {
        setTimeout(() => this.flush(), 0);
      }
    } catch (error) {
      // 落库失败只记警告，不影响用户体验
      console.warn('[EventQueue] Batch insert failed:', error);
      this.stats.failed += eventsToProcess.length;

      // 可选：将失败的事件重新入队重试（有丢数据风险，但保证性能）
      // 这里选择丢弃，避免无限重试阻塞队列
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats & { pending: number } {
    return {
      ...this.stats,
      pending: this.queue.length,
    };
  }

  /**
   * 启动定时器
   */
  private startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * 停止定时器
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 优雅关闭：等待队列清空
   */
  async shutdown(): Promise<void> {
    this.stop();
    await this.flush();
  }
}

// 全局单例
export const eventQueue = new EventQueue({
  flushIntervalMs: 3000, // 3秒
  batchSize: 100,
});

// 进程退出时优雅关闭
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('[EventQueue] SIGTERM received, flushing queue...');
    eventQueue.shutdown().then(() => {
      console.log('[EventQueue] Queue flushed, exiting.');
    });
  });

  process.on('SIGINT', () => {
    console.log('[EventQueue] SIGINT received, flushing queue...');
    eventQueue.shutdown().then(() => {
      console.log('[EventQueue] Queue flushed, exiting.');
    });
  });
}
