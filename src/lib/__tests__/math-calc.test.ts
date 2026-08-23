import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  evaluateWolframLanguage: vi.fn(),
}));

vi.mock('@/lib/wolfram-cloud-mcp', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/wolfram-cloud-mcp')>();
  return {
    ...original,
    evaluateWolframLanguage: mocks.evaluateWolframLanguage,
  };
});

import {
  MathCalculateCapacityError,
  MathCalculateUnavailableError,
  runMathCalculate,
} from '@/lib/math-calc';
import { WolframCloudMcpError } from '@/lib/wolfram-cloud-mcp';

function okEvaluatorText(result = '1') {
  const payload = JSON.stringify({
    status: 'ok',
    result,
    steps: [{
      step: 1,
      description: 'identify',
      operation: 'identify',
      input: '1',
      output: result,
    }],
  });
  return `Out[1]= ${JSON.stringify(payload)}`;
}

describe('math calculate executor', () => {
  const pendingEvaluations: Array<{
    resolve: (value: string) => void;
    reject: (reason: unknown) => void;
    code: string;
  }> = [];

  beforeEach(() => {
    pendingEvaluations.length = 0;
    mocks.evaluateWolframLanguage.mockReset();
    mocks.evaluateWolframLanguage.mockImplementation((code: string) => new Promise<string>((resolve, reject) => {
      pendingEvaluations.push({ resolve, reject, code });
    }));
  });

  it('returns a structured calculator error from Cloud MCP output', async () => {
    const pending = runMathCalculate({ expression: 'x -', operation: 'simplify' });
    await Promise.resolve();
    pendingEvaluations[0]?.resolve(`Out[1]= ${JSON.stringify(JSON.stringify({
      status: 'error',
      result: '',
      steps: [],
      error: 'invalid syntax',
    }))}`);

    await expect(pending).resolves.toEqual({
      status: 'error',
      result: '',
      steps: [],
      error: 'invalid syntax',
    });
  });

  it('sends calc.wls to WolframLanguageEvaluator through Cloud MCP', async () => {
    const pending = runMathCalculate({ expression: 'x', operation: 'simplify' });
    await Promise.resolve();

    expect(mocks.evaluateWolframLanguage).toHaveBeenCalledTimes(1);
    const [code, options] = mocks.evaluateWolframLanguage.mock.calls[0] as [string, { timeConstraintSeconds?: number }];
    expect(code).toContain('rawInput = mathCalcPayload;');
    expect(code).toContain('FromCharacterCode[');
    expect(code).toContain('calculate[');
    expect(code).not.toContain('Last[$ScriptCommandLine]');
    expect(options.timeConstraintSeconds).toBe(30);

    pendingEvaluations[0]?.resolve(okEvaluatorText());
    await pending;
  });

  it('projects Cloud MCP failures into the stable unavailable error', async () => {
    const pending = runMathCalculate({ expression: 'x', operation: 'simplify' });
    await Promise.resolve();
    pendingEvaluations[0]?.reject(new WolframCloudMcpError('Wolfram Cloud MCP 不可用'));

    const error = await pending.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(MathCalculateUnavailableError);
    expect(error).toMatchObject({
      name: 'MathCalculateUnavailableError',
      message: '公式计算运行时不可用',
    });
    expect(String(error)).not.toContain('agenttools.wolfram.com');
  });

  it('limits Cloud MCP concurrency for every caller of the shared executor', async () => {
    const calculations = Array.from({ length: 9 }, () => runMathCalculate({ expression: '1' }));
    const saturated = expect(
      runMathCalculate({ expression: '1' })
    ).rejects.toBeInstanceOf(MathCalculateCapacityError);
    await Promise.resolve();

    let assertionError: unknown;
    try {
      expect(mocks.evaluateWolframLanguage).toHaveBeenCalledTimes(1);
    } catch (error) {
      assertionError = error;
    }
    await saturated;

    for (let index = 0; index < calculations.length; index += 1) {
      while (!pendingEvaluations[index]) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      pendingEvaluations[index].resolve(okEvaluatorText());
      await new Promise((resolve) => setImmediate(resolve));
    }
    await Promise.allSettled(calculations);

    if (assertionError) throw assertionError;
    expect(mocks.evaluateWolframLanguage).toHaveBeenCalledTimes(9);
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
