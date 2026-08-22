import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}));

import {
  MathCalculateCapacityError,
  MathCalculateUnavailableError,
  runMathCalculate,
} from '@/lib/math-calc';

interface FakeChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: {
    on: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  kill: ReturnType<typeof vi.fn>;
}

function createFakeChildProcess(): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
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

function completeCalculation(child: FakeChildProcess) {
  child.stdout.emit('data', Buffer.from(JSON.stringify({
    status: 'ok',
    result: '1',
    steps: [],
  })));
  child.emit('close', 0);
}

describe('math calculate executor', () => {
  const children: FakeChildProcess[] = [];

  beforeEach(() => {
    children.length = 0;
    mocks.spawn.mockReset();
    mocks.spawn.mockImplementation(() => {
      const child = createFakeChildProcess();
      children.push(child);
      return child;
    });
  });

  it('returns a structured calculator error even when the process exits non-zero', async () => {
    const child = createFakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const pending = runMathCalculate({ expression: 'x -', operation: 'simplify' });
    await Promise.resolve();
    child.stdout.emit('data', Buffer.from(JSON.stringify({
      status: 'error',
      result: '',
      steps: [],
      error: 'invalid syntax',
    })));
    child.emit('close', 2);

    await expect(pending).resolves.toEqual({
      status: 'error',
      result: '',
      steps: [],
      error: 'invalid syntax',
    });
  });

  it('spawns wolframscript with the Wolfram Language calculator', async () => {
    const child = createFakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const pending = runMathCalculate({ expression: 'x', operation: 'simplify' });
    await Promise.resolve();

    expect(mocks.spawn).toHaveBeenCalledWith(
      'wolframscript',
      [
        '-file',
        join(process.cwd(), 'scripts', 'math-calc', 'calc.wls'),
        JSON.stringify({ expression: 'x', operation: 'simplify' }),
      ],
      expect.objectContaining({ cwd: process.cwd(), windowsHide: true }),
    );
    expect(child.stdin.write).not.toHaveBeenCalled();

    completeCalculation(child);
    await pending;
  });

  it('projects a non-zero calculator exit into the stable unavailable error without stderr details', async () => {
    const child = createFakeChildProcess();
    mocks.spawn.mockReturnValue(child);

    const pending = runMathCalculate({ expression: 'x', operation: 'simplify' });
    await Promise.resolve();
    child.stderr.emit('data', Buffer.from('private runtime details'));
    child.emit('close', 2);

    const error = await pending.catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(MathCalculateUnavailableError);
    expect(error).toMatchObject({
      name: 'MathCalculateUnavailableError',
      message: '公式计算运行时不可用',
    });
    expect(String(error)).not.toContain('private runtime details');
  });

  it('limits subprocess concurrency for every caller of the shared executor', async () => {
    const calculations = Array.from({ length: 9 }, () => runMathCalculate({ expression: '1' }));
    const saturated = expect(
      runMathCalculate({ expression: '1' })
    ).rejects.toBeInstanceOf(MathCalculateCapacityError);
    await Promise.resolve();

    let assertionError: unknown;
    try {
      expect(mocks.spawn).toHaveBeenCalledTimes(1);
    } catch (error) {
      assertionError = error;
    }
    await saturated;

    for (let index = 0; index < calculations.length; index += 1) {
      while (!children[index]) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      completeCalculation(children[index]);
      await new Promise((resolve) => setImmediate(resolve));
    }
    await Promise.allSettled(calculations);

    if (assertionError) throw assertionError;
    expect(mocks.spawn).toHaveBeenCalledTimes(9);
  });

  it('keeps Wolfram parsing held and allowlisted before evaluation', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'math-calc', 'calc.wls'), 'utf8');

    expect(script).toContain('HoldComplete');
    expect(script).toContain('allowedHeads');
    expect(script).toContain('ReleaseHold');
    expect(script).toContain('containsUnevaluatedComputationQ');
    expect(script).toContain('Sqrt');
    expect(script).toContain('Factorial');
    expect(script).toContain('Gamma');
    expect(script).toContain('hasUnknownPlainFunctionQ');
    expect(script.indexOf('ReleaseHold')).toBeGreaterThan(script.indexOf('allowedHeads'));
  });
});
