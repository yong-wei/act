const VALID_FOR_MS = 900;
const MAX_KEYS = 256;
type SharedReads = Map<string, { expiresAt: number; value: Promise<unknown> }>;
const sharedKey = Symbol.for('act.interactive-classroom-shared-reads');
const shared = globalThis as typeof globalThis & { [sharedKey]?: SharedReads };
const reads = shared[sharedKey] ??= new Map();

export function isClassroomCapacityEnabled() {
  return process.env.INTERACTIVE_CLASSROOM_CAPACITY === '1';
}

export async function loadSharedClassroomRead<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs: number | ((value: T) => number) = VALID_FOR_MS,
): Promise<T> {
  if (!isClassroomCapacityEnabled()) return load();
  const existing = reads.get(key);
  if (existing && existing.expiresAt > performance.now()) return existing.value as Promise<T>;
  reads.delete(key);
  if (reads.size >= MAX_KEYS) {
    const oldest = reads.keys().next().value;
    if (oldest) reads.delete(oldest);
  }
  const entry = { expiresAt: Infinity, value: load() };
  reads.set(key, entry);
  try {
    const value = await entry.value;
    const retention = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
    entry.expiresAt = performance.now() + retention;
    return value;
  } catch (error) {
    if (reads.get(key) === entry) reads.delete(key);
    throw error;
  }
}

export function invalidateSharedClassroomRead(key: string) {
  reads.delete(key);
}

export function isClassroomStreamEnabled() {
  return isClassroomCapacityEnabled() && process.env.INTERACTIVE_CLASSROOM_STREAM !== '0';
}
