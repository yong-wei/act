export type KnowledgeGraphCameraTransitionFrame = (progress: number) => void;

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  const progress = clampProgress(value);
  return 1 - ((1 - progress) ** 3);
}

export class KnowledgeGraphCameraTransition {
  private frame: number | null = null;
  private cancelFrame: ((frame: number) => void) | null = null;
  private generation = 0;

  cancel() {
    this.generation += 1;
    if (this.frame !== null) this.cancelFrame?.(this.frame);
    this.frame = null;
    this.cancelFrame = null;
  }

  start(durationMs: number, onFrame: KnowledgeGraphCameraTransitionFrame) {
    this.cancel();
    const generation = this.generation;
    if (durationMs <= 0) {
      onFrame(1);
      return;
    }

    const requestFrame = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    const cancelFrame = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (frame: number) => window.clearTimeout(frame);
    this.cancelFrame = cancelFrame;
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (generation !== this.generation) return;
      const progress = clampProgress((now - startedAt) / durationMs);
      onFrame(easeOutCubic(progress));
      if (progress >= 1) {
        this.frame = null;
        this.cancelFrame = null;
        return;
      }
      this.frame = requestFrame(tick);
    };
    this.frame = requestFrame(tick);
  }

  dispose() {
    this.cancel();
  }
}
