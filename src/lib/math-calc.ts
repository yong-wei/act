/**
 * 受治理的 SymPy 公式计算执行器。
 *
 * API 路由与 KAQ calculate 工具共用此入口：以受限 JSON 载荷调用
 * scripts/math-calc/calc.py，并将结构化结果（LaTeX + 中间步骤）返回给调用方。
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { z } from 'zod';

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

const MATH_CALC_SCRIPT_PATH = join(process.cwd(), 'scripts', 'math-calc', 'calc.py');
const MATH_CALC_TIMEOUT_MS = 10_000;

export class MathCalculateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathCalculateUnavailableError';
  }
}

function isErrnoError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
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

/**
 * 执行一次 SymPy 计算。
 *
 * 子进程 10 秒超时；Python 或脚本缺失时抛出
 * MathCalculateUnavailableError，调用方应投影为 503。
 */
export async function runMathCalculate(input: MathCalculateRequest): Promise<MathCalculateResponse> {
  const validatedInput = mathCalculateRequestSchema.parse(input);
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  const payload = JSON.stringify(validatedInput);

  return new Promise<MathCalculateResponse>((resolve, reject) => {
    const child = spawn(pythonCommand, [MATH_CALC_SCRIPT_PATH], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        resolve({
          status: 'error',
          result: '',
          steps: [],
          error: '公式计算超时',
        });
      }
    }, MATH_CALC_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      // Consume stderr without exposing provider or runtime details to callers.
      void chunk;
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (isErrnoError(error) && error.code === 'ENOENT') {
        reject(new MathCalculateUnavailableError('Python 运行时不可用'));
        return;
      }
      reject(new MathCalculateUnavailableError('公式计算运行时不可用'));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      const parsed = parseMathCalculateResponse(stdout);
      if (code !== 0) {
        if (parsed?.status === 'error') {
          resolve(parsed);
          return;
        }
        reject(new MathCalculateUnavailableError('公式计算运行时不可用'));
        return;
      }

      if (!parsed) {
        reject(new MathCalculateUnavailableError('公式计算运行时不可用'));
        return;
      }
      resolve(parsed);
    });

    child.stdin.on('error', () => {
      // 子进程提前退出时忽略 EPIPE。
    });
    child.stdin.write(payload, 'utf8');
    child.stdin.end();
  });
}
