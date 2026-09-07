import type { UniversalResourceViewerDescriptor } from './types';

export interface ResourceViewerOpenRequest {
  descriptor: UniversalResourceViewerDescriptor;
  opener: HTMLElement | null;
}

type ResourceViewerSubscriber = (request: ResourceViewerOpenRequest) => void;

const subscribers = new Set<ResourceViewerSubscriber>();

export function openResourceViewer(descriptor: UniversalResourceViewerDescriptor): void {
  if (subscribers.size === 0) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('UniversalResourceViewerHost is not mounted.');
    }
    return;
  }
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // 单所有者语义：同一页面可能同时存在已挂载宿主（/knowledge、自适应练习）
  // 与控灵聊天渲染器宿主；只通知最后注册的宿主，避免一次点击打开多个
  // Radix Dialog 与焦点恢复冲突（#2047 review）。
  const [owner] = [...subscribers].slice(-1);
  if (owner) owner({ descriptor, opener });
}

/** 统一查看器壳是否已挂载（未挂载时调用方降级为整页路由）。 */
export function isResourceViewerAvailable(): boolean {
  return subscribers.size > 0;
}

export function subscribeResourceViewer(subscriber: ResourceViewerSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
