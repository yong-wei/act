export * from 'three/src/Three.js';

export class Clock {
  autoStart: boolean;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  running = false;

  constructor(autoStart = true) {
    this.autoStart = autoStart;
  }

  start() {
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }

    if (!this.running) return 0;

    const newTime = performance.now();
    const diff = (newTime - this.oldTime) / 1000;
    this.oldTime = newTime;
    this.elapsedTime += diff;
    return diff;
  }
}
