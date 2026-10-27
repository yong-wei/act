/** 2026-10-26 本机对 /api/health 的并发抽查：120 与 160 路同时请求均全部返回。名额取 120，留出余量。 */
export const SIMULATION_ONLINE_CAPACITY = 120;
export const ADMISSION_HOLD_MS = 10 * 60 * 1000;

export type AdmissionDecision = {
  status: 'admitted' | 'queued';
  capacity: number;
  online: number;
  waiting: number;
  position: number | null;
  suggestedWaitMinutes: number | null;
  message: string;
};

type Hold = { id: string; expiresAt: number };

export class AdmissionGate {
  private holds = new Map<string, Hold>();
  private queue: string[] = [];

  constructor(
    private readonly capacity = SIMULATION_ONLINE_CAPACITY,
    private readonly holdMs = ADMISSION_HOLD_MS,
  ) {}

  request(id: string, now = Date.now()): AdmissionDecision {
    this.prune(now);
    const existing = this.holds.get(id);
    if (existing) {
      existing.expiresAt = now + this.holdMs;
      return this.admitted(id);
    }
    const queuedAt = this.queue.indexOf(id);
    if (queuedAt >= 0) return this.queued(queuedAt + 1);
    if (this.holds.size < this.capacity) {
      this.holds.set(id, { id, expiresAt: now + this.holdMs });
      return this.admitted(id);
    }
    this.queue.push(id);
    return this.queued(this.queue.length);
  }

  snapshot(now = Date.now()) {
    this.prune(now);
    return { capacity: this.capacity, online: this.holds.size, waiting: this.queue.length };
  }

  reset() {
    this.holds.clear();
    this.queue = [];
  }

  private prune(now: number) {
    for (const [id, hold] of this.holds) {
      if (hold.expiresAt <= now) this.holds.delete(id);
    }
    while (this.queue.length > 0 && this.holds.size < this.capacity) {
      const id = this.queue.shift();
      if (!id) break;
      this.holds.set(id, { id, expiresAt: now + this.holdMs });
    }
  }

  private admitted(id: string): AdmissionDecision {
    return {
      status: 'admitted',
      capacity: this.capacity,
      online: this.holds.size,
      waiting: this.queue.length,
      position: null,
      suggestedWaitMinutes: null,
      message: this.holds.has(id)
        ? `可以进入。当前在线 ${this.holds.size} / ${this.capacity}。`
        : '可以进入。',
    };
  }

  private queued(position: number): AdmissionDecision {
    return {
      status: 'queued',
      capacity: this.capacity,
      online: this.holds.size,
      waiting: this.queue.length,
      position,
      suggestedWaitMinutes: Math.max(5, position),
      message: `当前同时在线已满（${this.holds.size} / ${this.capacity}）。你排在第 ${position} 位。请等待约 ${Math.max(5, position)} 分钟，或按班级分批进入，错开同一时刻集中打开实验。`,
    };
  }
}

export const simulationAdmission = new AdmissionGate();
