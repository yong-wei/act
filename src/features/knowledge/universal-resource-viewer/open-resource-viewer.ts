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
  for (const subscriber of subscribers) subscriber({ descriptor, opener });
}

/** 统一查看器壳是否已挂载（未挂载时调用方降级为整页路由）。 */
export function isResourceViewerAvailable(): boolean {
  return subscribers.size > 0;
}

export function subscribeResourceViewer(subscriber: ResourceViewerSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
