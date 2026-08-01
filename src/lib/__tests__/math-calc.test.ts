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

import { runMathCalculate } from '@/lib/math-calc';

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

  it('limits subprocess concurrency for every caller of the shared executor', async () => {
    const calculations = Array.from({ length: 12 }, () => runMathCalculate({ expression: '1' }));
    await Promise.resolve();

    let assertionError: unknown;
    try {
      expect(mocks.spawn).toHaveBeenCalledTimes(4);
    } catch (error) {
      assertionError = error;
    }

    for (let index = 0; index < children.length; index += 1) {
      completeCalculation(children[index]);
      await Promise.resolve();
    }
    await Promise.allSettled(calculations);

    if (assertionError) throw assertionError;
    expect(mocks.spawn).toHaveBeenCalledTimes(12);
  });

  it('keeps the Python backend and LaTeX parser verifiable in the production image', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'math-calc', 'calc.py'), 'utf8');
    const requirements = readFileSync(
      join(process.cwd(), 'scripts', 'math-calc', 'requirements.txt'),
      'utf8'
    );
    const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8');
    const entrypoint = readFileSync(join(process.cwd(), 'docker-entrypoint.sh'), 'utf8');

    expect(script).toMatch(/^#!\/usr\/bin\/env python3\r?\n"""/);
    expect(requirements).toContain('antlr4-python3-runtime==4.11.1');
    expect(dockerfile).toContain('python3 -m py_compile scripts/math-calc/calc.py');
    expect(dockerfile).toContain('parse_latex');
    expect(entrypoint).toContain('parse_latex');
  });
});
