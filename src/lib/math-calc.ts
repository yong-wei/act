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

export const mathCalculateRequestSchema = z.object({
  expression: z.string().trim().min(1).max(300),
  operation: z.enum(MATH_CALC_OPERATIONS).optional(),
  variable: z.string().min(1).max(10).optional(),
});

export type MathCalculateRequest = z.infer<typeof mathCalculateRequestSchema>;

export interface MathCalculateStep {
  step: number;
  description: string;
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

/**
 * 执行一次 SymPy 计算。
 *
 * 子进程 10 秒超时；Python 或脚本缺失时抛出
 * MathCalculateUnavailableError，调用方应投影为 503。
 */
export async function runMathCalculate(input: MathCalculateRequest): Promise<MathCalculateResponse> {
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
  const payload = JSON.stringify(input);

  return new Promise<MathCalculateResponse>((resolve, reject) => {
    const child = spawn(pythonCommand, [MATH_CALC_SCRIPT_PATH], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
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
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (isErrnoError(error) && error.code === 'ENOENT') {
        reject(new MathCalculateUnavailableError('Python 运行时不可用'));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        resolve({
          status: 'error',
          result: '',
          steps: [],
          error: stderr.trim() || `SymPy 计算失败（退出码 ${code ?? 'unknown'}）`,
        });
        return;
      }

      try {
        const parsed: unknown = JSON.parse(stdout);
        if (!parsed || typeof parsed !== 'object') {
          resolve({
            status: 'error',
            result: '',
            steps: [],
            error: 'SymPy 返回了无法解析的结果',
          });
          return;
        }

        const record = parsed as Record<string, unknown>;
        if (record.status === 'ok') {
          resolve({
            status: 'ok',
            result: typeof record.result === 'string' ? record.result : '',
            steps: Array.isArray(record.steps) ? (record.steps as MathCalculateStep[]) : [],
          });
          return;
        }

        resolve({
          status: 'error',
          result: typeof record.result === 'string' ? record.result : '',
          steps: Array.isArray(record.steps) ? (record.steps as MathCalculateStep[]) : [],
          error: typeof record.error === 'string' ? record.error : 'SymPy 计算失败',
        });
      } catch {
        resolve({
          status: 'error',
          result: '',
          steps: [],
          error: 'SymPy 返回了无法解析的结果',
        });
      }
    });

    child.stdin.on('error', () => {
      // 子进程提前退出时忽略 EPIPE。
    });
    child.stdin.write(payload, 'utf8');
    child.stdin.end();
  });
}
