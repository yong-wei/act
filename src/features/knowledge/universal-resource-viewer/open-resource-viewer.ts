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

export function subscribeResourceViewer(subscriber: ResourceViewerSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
