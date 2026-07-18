// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphCameraTransition } from '../graph/camera-transition';

describe('knowledge graph camera transition cancellation', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('cancels an active transition before starting a newer target', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const frame = ++nextFrame;
      callbacks.set(frame, callback);
      return frame;
    });
    const cancelAnimationFrame = vi.fn((frame: number) => callbacks.delete(frame));
    window.requestAnimationFrame = requestAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrame;

    const transition = new KnowledgeGraphCameraTransition();
    const staleFrames: number[] = [];
    const currentFrames: number[] = [];
    transition.start(240, (progress) => staleFrames.push(progress));
    transition.start(240, (progress) => currentFrames.push(progress));

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(staleFrames).toEqual([]);
    callbacks.get(2)?.(performance.now() + 120);
    expect(currentFrames.length).toBe(1);
    expect(currentFrames[0]).toBeGreaterThan(0);

    transition.cancel();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(3);
    transition.dispose();
  });

  it('commits reduced motion immediately without scheduling a frame', () => {
    const requestAnimationFrame = vi.fn(() => 1);
    window.requestAnimationFrame = requestAnimationFrame;
    const transition = new KnowledgeGraphCameraTransition();
    const frames: number[] = [];

    transition.start(0, (progress) => frames.push(progress));

    expect(frames).toEqual([1]);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    transition.dispose();
  });
});
