import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}));

import {
  MathCalculateUnavailableError,
  runMathCalculate,
} from '@/lib/math-calc';

function createChildProcessMock() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { on: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
  child.kill = vi.fn();
  return child;
}

describe('runMathCalculate', () => {
  it('projects a non-zero calculator exit into the stable unavailable error', async () => {
    const child = createChildProcessMock();
    mocks.spawn.mockReturnValue(child);

    const pending = runMathCalculate({ expression: 'x', operation: 'simplify' });
    child.emit('close', 2);

    const error = await pending.catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(MathCalculateUnavailableError);
    expect(error).toMatchObject({
      name: 'MathCalculateUnavailableError',
      message: '公式计算运行时不可用',
    });
  });
});
