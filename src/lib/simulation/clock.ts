import type { SimulationClockOptions } from './types';

export class SimulationClock {
  private dt: number;
  private accumulator: number = 0;
  private maxSubSteps: number;

  constructor(options: SimulationClockOptions) {
    this.dt = options.dt;
    this.maxSubSteps = options.maxSubSteps ?? 5;
  }

  reset() {
    this.accumulator = 0;
  }

  advance(
    deltaTime: number,
    step: (dt: number) => void | boolean,
    timeScale: number = 1
  ) {
    this.accumulator += deltaTime * timeScale;
    let steps = 0;
    while (this.accumulator >= this.dt && steps < this.maxSubSteps) {
      const shouldContinue = step(this.dt);
      this.accumulator -= this.dt;
      steps += 1;
      if (shouldContinue === false) {
        this.accumulator = 0;
        break;
      }
    }
    return steps;
  }
}
