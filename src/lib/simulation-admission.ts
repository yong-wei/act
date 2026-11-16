/** 历史连接抽查使用的独立内存计数参数。 */
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
        ? `已登记本次连接抽查。当前抽查记录 ${this.holds.size} / ${this.capacity}。`
        : '已登记本次连接抽查。',
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
      message: `当前连接抽查记录已满（${this.holds.size} / ${this.capacity}），本次抽查排在第 ${position} 位。按班级分批的安排需参考持续负载实测。`,
    };
  }
}

export const simulationAdmission = new AdmissionGate();
