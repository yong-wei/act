/**
 * 受治理的 Wolfram 公式计算执行器。
 *
 * API 路由与控灵预计算共用此入口：把 scripts/math-calc/calc.wls 交给
 * Wolfram Cloud MCP 的 WolframLanguageEvaluator，并将结构化结果
 * （LaTeX + 中间步骤）返回给调用方。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import {
  WolframCloudMcpError,
  buildCalcWlsCloudProgram,
  evaluateWolframLanguage,
  unwrapWolframEvaluatorText,
} from '@/lib/wolfram-cloud-mcp';

export const MATH_CALC_OPERATIONS = [
  'simplify',
  'expand',
  'factor',
  'apart',
  'diff',
  'integrate',
  'laplace',
  'inverse_laplace',
] as const;

export type MathCalcOperation = (typeof MATH_CALC_OPERATIONS)[number];

const MATH_CALC_EXPRESSION_PATTERN = /^[A-Za-z0-9+\-*/^().,\s\\{}\[\]]+$/;
const MATH_CALC_VARIABLE_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,9}$/;

export const mathCalculateRequestSchema = z.object({
  expression: z.string().trim().min(1).max(300).regex(MATH_CALC_EXPRESSION_PATTERN, '表达式包含不允许的字符'),
  operation: z.enum(MATH_CALC_OPERATIONS).optional(),
  variable: z.string().min(1).max(10).regex(MATH_CALC_VARIABLE_PATTERN, '变量包含不允许的字符').optional(),
});

export type MathCalculateRequest = z.infer<typeof mathCalculateRequestSchema>;

export interface MathCalculateStep {
  step: number;
  description: string;
  operation: string;
  input: string;
  output: string;
}

export interface MathCalculateSuccess {
  status: 'ok';
  result: string;
  steps: MathCalculateStep[];
}

export interface MathCalculateFailure {
  status: 'error';
  result: string;
  steps: MathCalculateStep[];
  error: string;
}

export type MathCalculateResponse = MathCalculateSuccess | MathCalculateFailure;

const MATH_CALC_SCRIPT_PATH = join(/*turbopackIgnore: true*/ process.cwd(), 'scripts', 'math-calc', 'calc.wls');
const MATH_CALC_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_CALCULATIONS = 1;
const MAX_QUEUED_CALCULATIONS = 8;

let activeCalculations = 0;
const releaseQueue: Array<() => void> = [];

export class MathCalculateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathCalculateUnavailableError';
  }
}

export class MathCalculateCapacityError extends Error {
  constructor() {
    super('公式计算并发超限，请稍后重试');
    this.name = 'MathCalculateCapacityError';
  }
}

async function acquireCalculationSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new MathCalculateUnavailableError('公式计算运行时不可用');
  }
  if (activeCalculations < MAX_CONCURRENT_CALCULATIONS) {
    activeCalculations += 1;
    return;
  }
  if (releaseQueue.length >= MAX_QUEUED_CALCULATIONS) {
    throw new MathCalculateCapacityError();
  }
  await new Promise<void>((resolve, reject) => {
    // 排队期间调用方取消时移出队列（Issue #1724 review）：不再占用槽，
    // 也不在槽释放后被唤醒执行。
    const settle = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => {
      const index = releaseQueue.indexOf(settle);
      if (index >= 0) {
        releaseQueue.splice(index, 1);
      }
      reject(new MathCalculateUnavailableError('公式计算运行时不可用'));
    };
    releaseQueue.push(settle);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function releaseCalculationSlot(): void {
  const next = releaseQueue.shift();
  if (next) {
    next();
    return;
  }
  activeCalculations = Math.max(0, activeCalculations - 1);
}

function isMathCalculateStep(value: unknown): value is MathCalculateStep {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Number.isInteger(record.step)
    && typeof record.description === 'string'
    && typeof record.operation === 'string'
    && typeof record.input === 'string'
    && typeof record.output === 'string';
}

function parseMathCalculateResponse(stdout: string): MathCalculateResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;
  if ((record.status !== 'ok' && record.status !== 'error')
    || typeof record.result !== 'string'
    || !Array.isArray(record.steps)
    || !record.steps.every(isMathCalculateStep)) {
    return null;
  }
  if (record.status === 'error') {
    if (typeof record.error !== 'string' || !record.error.trim()) return null;
    return {
      status: 'error',
      result: record.result,
      steps: record.steps,
      error: record.error,
    };
  }
  return {
    status: 'ok',
    result: record.result,
    steps: record.steps,
  };
}

function loadCalcScript(): string {
  try {
    return readFileSync(MATH_CALC_SCRIPT_PATH, 'utf8');
  } catch {
    throw new MathCalculateUnavailableError('公式计算运行时不可用');
  }
}

/**
 * 执行一次 Wolfram Cloud MCP 计算。
 *
 * 30 秒超时；Cloud MCP 不可达或脚本缺失时抛出
 * MathCalculateUnavailableError，调用方应投影为 503。
 */
async function executeMathCalculate(
  input: MathCalculateRequest,
  signal?: AbortSignal,
): Promise<MathCalculateResponse> {
  const payload = JSON.stringify(input);
  const program = buildCalcWlsCloudProgram(loadCalcScript(), payload);
  const timeConstraintSeconds = Math.max(1, Math.ceil(MATH_CALC_TIMEOUT_MS / 1000));

  let output: string;
  try {
    output = await evaluateWolframLanguage(program, {
      timeoutMs: MATH_CALC_TIMEOUT_MS,
      timeConstraintSeconds,
      signal,
    });
  } catch (error) {
    if (error instanceof WolframCloudMcpError && error.message === '公式计算超时') {
      return {
        status: 'error',
        result: '',
        steps: [],
        error: '公式计算超时',
      };
    }
    throw new MathCalculateUnavailableError('公式计算运行时不可用');
  }

  let jsonText: string;
  try {
    jsonText = unwrapWolframEvaluatorText(output);
  } catch {
    throw new MathCalculateUnavailableError('公式计算运行时不可用');
  }

  const parsed = parseMathCalculateResponse(jsonText);
  if (!parsed) {
    throw new MathCalculateUnavailableError('公式计算运行时不可用');
  }
  return parsed;
}

export async function runMathCalculate(
  input: MathCalculateRequest,
  options?: { signal?: AbortSignal },
): Promise<MathCalculateResponse> {
  const parsedInput = mathCalculateRequestSchema.parse(input);
  await acquireCalculationSlot(options?.signal);
  try {
    return await executeMathCalculate(parsedInput, options?.signal);
  } finally {
    releaseCalculationSlot();
  }
}
