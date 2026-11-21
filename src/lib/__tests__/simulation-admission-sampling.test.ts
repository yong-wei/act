import { afterEach, expect, it, vi } from 'vitest';

const readFile = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ readFile }));
import { getHostAdmissionScale } from '../simulation-admission-pressure';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('shares pending reads and waits for two fresh samples after a delayed read', async () => {
  vi.useFakeTimers({ toFake: ['performance', 'setInterval', 'clearInterval'] });
  const logs = vi.spyOn(console, 'info').mockImplementation(() => {});
  let release!: (value: string) => void;
  let hostReads = 0;
  readFile.mockImplementation(async (path: string) => {
    if (path !== '/proc/stat') return '';
    hostReads++;
    if (hostReads === 1) return new Promise<string>(resolve => { release = resolve; });
    return `cpu 10 0 0 ${hostReads * 100} 0 0 0 0\ncpu0 0\n`;
  });
  const first = getHostAdmissionScale();
  await vi.advanceTimersByTimeAsync(4000);
  expect(getHostAdmissionScale()).toBe(first);
  expect(hostReads).toBe(1);
  release('cpu 1 0 0 10 0 0 0 0\ncpu0 0\n');
  expect(await first).toBe(0);
  expect(logs).toHaveBeenCalledWith('[simulation-admission]', expect.stringContaining('"reason":"slow-read"'));
  expect(await getHostAdmissionScale()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await getHostAdmissionScale()).toBe(0.5);
});
