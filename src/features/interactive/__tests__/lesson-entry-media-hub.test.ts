import { describe, expect, it, vi } from 'vitest';

import { createNativeMediaCoordinator } from '@/features/interactive/shared/lesson-entry-media-hub';

function media(paused = false) {
  return {
    paused,
    currentTime: 37,
    pause: vi.fn(),
  } as unknown as HTMLMediaElement;
}

describe('LessonEntryMediaHub native media coordination', () => {
  it.each([
    ['audio to video', 'audio', 'video'],
    ['video to audio', 'video', 'audio'],
    ['video to video', 'video', 'video'],
  ])('pauses the previously playing element for %s', (_label, _firstType, _secondType) => {
    const coordinator = createNativeMediaCoordinator();
    const first = media(false);
    const second = media(true);
    coordinator.register(first);
    coordinator.register(second);

    coordinator.play(second);

    expect(first.pause).toHaveBeenCalledOnce();
    expect(second.pause).not.toHaveBeenCalled();
    expect(first.currentTime).toBe(37);
  });

  it('does not pause the media element that started playing', () => {
    const coordinator = createNativeMediaCoordinator();
    const element = media(false);
    coordinator.register(element);

    coordinator.play(element);

    expect(element.pause).not.toHaveBeenCalled();
  });

  it('stops coordinating an element after it is unregistered', () => {
    const coordinator = createNativeMediaCoordinator();
    const removed = media(false);
    const current = media(true);
    const unregister = coordinator.register(removed);
    coordinator.register(current);

    unregister();
    coordinator.play(current);

    expect(removed.pause).not.toHaveBeenCalled();
  });
});
