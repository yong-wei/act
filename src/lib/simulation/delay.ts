export class DelayLine<T> {
  private buffer: T[];
  private steps: number;

  constructor(delaySeconds: number, dt: number, initialValue: T) {
    this.steps = delaySeconds > 0 ? Math.max(1, Math.round(delaySeconds / dt)) : 0;
    this.buffer = Array(this.steps + 1).fill(initialValue);
  }

  push(value: T) {
    if (this.steps <= 0) return value;
    this.buffer.push(value);
    return this.buffer.shift() as T;
  }

  reset(value: T) {
    this.buffer = Array(this.steps + 1).fill(value);
  }
}
