import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';

const SAMPLE_MS = 1000;
const INCREASE_MS = 8000;
const CONFIRMATION_LIMIT_MS = 1500;
const FEEDBACK_TTL_MS = 15_000;
const MAX_CPU = 0.90;
const DECREASE_CPU = 0.80;
const INCREASE_CPU = 0.70;
const MIN_SPARE_CORES = 0.40;

type HostCpu = { total: number; busy: number; cores: number };
type Sample = HostCpu & { quotaCores: number; quotaUsage?: number };
type State = {
  previous?: Sample;
  scale: number;
  healthySince?: number;
  confirmationSlowUntil: number;
  nextSampleAt: number;
  sample?: Promise<number>;
  sampling?: boolean;
  lastSampleAt?: number;
  timer?: ReturnType<typeof setInterval>;
  lastReportedScale?: number;
  lastReportedReason?: string;
};

const key = Symbol.for('act.simulation.admission-pressure');
const shared = globalThis as typeof globalThis & { [key]?: State };
const state = shared[key] ??= { scale: 1, confirmationSlowUntil: 0, nextSampleAt: 0 };

export function parseAdmissionHostCpu(value: string): HostCpu | undefined {
  const lines = value.split('\n');
  if (!/^cpu\s/.test(lines[0])) return;
  // Guest time is already included in user/nice. I/O wait is not available headroom.
  const times = lines[0].trim().split(/\s+/).slice(1, 9).map(Number);
  const cores = lines.filter(line => /^cpu\d+\s/.test(line)).length;
  if (cores === 0 || times.length !== 8 || times.some(time => !Number.isFinite(time) || time < 0)) return;
  const total = times.reduce((sum, time) => sum + time, 0);
  return { total, busy: total - times[3], cores };
}

export function chooseAdmissionScale(previous: number, cpu: number, spareCores: number, confirmationSlow: boolean,
  healthyForMs: number, effectiveCores: number) {
  if (cpu >= MAX_CPU) return 0;
  if (cpu >= DECREASE_CPU || confirmationSlow) return Math.max(0.5, previous / 2);
  if (previous === 0) return 0.5;
  // Leave headroom for unrelated services, even at a low host percentage.
  if (cpu >= INCREASE_CPU || spareCores < MIN_SPARE_CORES || healthyForMs < INCREASE_MS) return previous;
  return Math.min(Math.max(1, Math.min(8, effectiveCores * 2)), previous + 0.5);
}

export function measureAdmissionCpu(previous: Sample, current: Sample, elapsedMs: number, parallelism: number) {
  if (elapsedMs <= 0 || elapsedMs > 3 * SAMPLE_MS || current.cores !== previous.cores
    || current.quotaCores !== previous.quotaCores || current.total <= previous.total || current.busy < previous.busy) return;
  const host = (current.busy - previous.busy) / (current.total - previous.total);
  const effectiveCores = Math.min(current.cores, parallelism, current.quotaCores);
  let used = host;
  let spareCores = Math.min(current.cores * (MAX_CPU - host), effectiveCores);
  if (Number.isFinite(current.quotaCores)) {
    if (current.quotaUsage === undefined || previous.quotaUsage === undefined
      || current.quotaUsage < previous.quotaUsage) return;
    const quota = (current.quotaUsage - previous.quotaUsage) / (elapsedMs * 1000 * effectiveCores);
    used = Math.max(host, quota);
    spareCores = Math.min(spareCores, effectiveCores * (MAX_CPU - quota));
  }
  return { used, spareCores, effectiveCores };
}

function reportScale(scale: number, cpu: number | null, cores: number | null, confirmationSlow: boolean, reason?: string, elapsedMs?: number) {
  if (scale !== state.lastReportedScale || reason !== state.lastReportedReason) {
    state.lastReportedScale = scale;
    state.lastReportedReason = reason;
    console.info('[simulation-admission]', JSON.stringify({ scale, cpu, cores, confirmationSlow, reason, elapsedMs }));
  }
  return scale;
}

async function samplePressure(now: number): Promise<number> {
  const [cpu, quota, usage] = await Promise.all([
    readFile('/proc/stat', 'utf8').catch(() => ''),
    readFile('/sys/fs/cgroup/cpu.max', 'utf8').catch(() => ''),
    readFile('/sys/fs/cgroup/cpu.stat', 'utf8').catch(() => ''),
  ]);
  const host = parseAdmissionHostCpu(cpu);
  const [maximum, period] = quota.trim().split(/\s+/).map(Number);
  const quotaCores = maximum > 0 && period > 0 ? maximum / period : Infinity;
  const quotaUsage = usage.match(/^usage_usec\s+(\d+)$/m)?.[1];
  const observedAt = performance.now();
  const lateRead = observedAt - now > 3 * SAMPLE_MS;
  const current = !lateRead && host ? { ...host, quotaCores, quotaUsage: quotaUsage === undefined ? undefined : Number(quotaUsage) } : undefined;
  const previous = state.previous;
  const elapsed = observedAt - (state.lastSampleAt ?? observedAt);
  state.lastSampleAt = observedAt;
  state.previous = current;
  const pressure = current && previous && measureAdmissionCpu(previous, current, elapsed, availableParallelism());
  if (!pressure) {
    state.healthySince = undefined;
    state.scale = 0;
    const reason = lateRead ? 'slow-read' : !host ? 'host-unavailable' : !previous ? 'no-baseline' :
      elapsed > 3 * SAMPLE_MS ? 'sample-gap' : 'counter-change';
    return reportScale(0, null, null, false, reason, Math.round(elapsed));
  }
  const { used, effectiveCores, spareCores } = pressure;
  const confirmationSlow = now < state.confirmationSlowUntil;
  const healthy = used < INCREASE_CPU && spareCores >= MIN_SPARE_CORES && !confirmationSlow;
  state.healthySince = healthy ? state.healthySince ?? now : undefined;
  const next = chooseAdmissionScale(state.scale, used, spareCores, confirmationSlow,
    now - (state.healthySince ?? now), effectiveCores);
  if (next > state.scale) state.healthySince = now;
  state.scale = next;
  return reportScale(next, used, effectiveCores, confirmationSlow);
}

function refreshPressure(): Promise<number> {
  const now = performance.now();
  if (!state.sample || (!state.sampling && now >= state.nextSampleAt)) {
    state.nextSampleAt = now + SAMPLE_MS;
    state.sampling = true;
    state.sample = samplePressure(now).finally(() => { state.sampling = false; });
  }
  return state.sample;
}

export function getSimulationAdmissionScale(): Promise<number> {
  if (process.env.SIMULATION_ADAPTIVE_ADMISSION !== '1') return Promise.resolve(1);
  return getHostAdmissionScale();
}

export function getHostAdmissionScale(): Promise<number> {
  state.timer ??= setInterval(() => { void refreshPressure(); }, SAMPLE_MS).unref();
  return refreshPressure();
}

export function recordSimulationConfirmation(durationMs: number, serviceFailure: boolean) {
  if (process.env.SIMULATION_ADAPTIVE_ADMISSION !== '1') return;
  if (serviceFailure || durationMs >= CONFIRMATION_LIMIT_MS) {
    state.confirmationSlowUntil = performance.now() + FEEDBACK_TTL_MS;
  }
}
