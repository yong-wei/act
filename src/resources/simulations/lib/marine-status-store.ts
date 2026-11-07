/**
 * MarineCanvas 实际生命周期状态的进程内共享（#2151 finding 修复）。
 *
 * 离屏能力探测只回答“环境是否可能支持”，不能代替真实画布的初始化与
 * 设备丢失事件。MarineCanvas 把自身状态发布到这里；共享就绪门订阅它，
 * 保证运行入口与真实引擎同源。
 */

export type MarineCanvasStatus = 'preparing-model' | 'preparing-graphics' | 'runnable' | 'failed';

let latest: MarineCanvasStatus | null = null;
const listeners = new Set<(status: MarineCanvasStatus | null) => void>();

export function publishMarineCanvasStatus(status: MarineCanvasStatus | null): void {
  latest = status;
  for (const listener of listeners) listener(status);
}

export function subscribeMarineCanvasStatus(listener: (status: MarineCanvasStatus | null) => void): () => void {
  listeners.add(listener);
  listener(latest);
  return () => { listeners.delete(listener); };
}

export function getMarineCanvasStatus(): MarineCanvasStatus | null {
  return latest;
}

/** 仅测试用：清空共享状态。 */
export function resetMarineCanvasStatusForTest(): void {
  latest = null;
  listeners.clear();
}
