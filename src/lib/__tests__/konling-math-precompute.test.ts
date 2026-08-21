import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runMathCalculate: vi.fn(),
}));

vi.mock('@/lib/math-calc', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/math-calc')>();
  return {
    ...original,
    runMathCalculate: mocks.runMathCalculate,
  };
});

import {
  buildMathPrecomputeContext,
  detectMathRequest,
  inferOperation,
  precomputeMathAnswer,
  withoutCalculateTool,
} from '@/lib/konling-math-precompute';

describe('Konling math precompute', () => {
  beforeEach(() => {
    mocks.runMathCalculate.mockReset();
  });

  it.each([
    ['请化简 (x^2-1)/(x-1)', 'simplify'],
    ['展开 (x+1)^2', 'expand'],
    ['因式分解 x^2-1', 'factor'],
    ['部分分式展开 s/(s+1)', 'apart'],
    ['求导 x^2', 'diff'],
    ['积分 sin(x)', 'integrate'],
    ['求 exp(t) 的拉普拉斯变换', 'laplace'],
    ['求 1/(s+1) 的拉普拉斯逆变换', 'inverse_laplace'],
  ] as const)('infers %s as %s', (text, expected) => {
    expect(inferOperation(text)).toBe(expected);
  });

  it('extracts and normalizes the representative inverse-Laplace expression', () => {
    expect(detectMathRequest(
      '求 F(s)=(s+3)/((s^2+2s+5)(s+1)) 的拉普拉斯逆变换',
    )).toEqual({
      expression: '(s+3)/((s^2+2*s+5)*(s+1))',
      operation: 'inverse_laplace',
      variable: 's',
    });
  });

  it('keeps precomputation enabled when the math request asks for detailed trailing work', () => {
    expect(detectMathRequest(
      '求 F(s)=(s+3)/((s^2+2s+5)(s+1)) 的拉普拉斯逆变换，写出部分分式待定系数方程和详细步骤。',
    )).toEqual({
      expression: '(s+3)/((s^2+2*s+5)*(s+1))',
      operation: 'inverse_laplace',
      variable: 's',
    });
  });

  it('preserves LaTeX commands while inferring variables outside command names', () => {
    expect(detectMathRequest('化简 2\\frac{x}{x+1}')).toEqual({
      expression: '2\\frac{x}{x+1}',
      operation: 'simplify',
      variable: 'x',
    });
  });

  it('returns null when no governed math operation is requested', () => {
    expect(detectMathRequest('请解释闭环系统为什么需要反馈')).toBeNull();
  });

  it('returns a successful shared-calculator result', async () => {
    mocks.runMathCalculate.mockResolvedValue({
      status: 'ok',
      result: '2 x',
      steps: [{
        step: 1,
        description: '执行求导',
        operation: 'diff',
        input: 'x^2',
        output: '2 x',
      }],
    });

    await expect(precomputeMathAnswer('求导 x^2')).resolves.toEqual({
      expression: 'x^2',
      operation: 'diff',
      variable: 'x',
      result: '2 x',
      steps: [{
        step: 1,
        description: '执行求导',
        operation: 'diff',
        input: 'x^2',
        output: '2 x',
      }],
    });
    expect(mocks.runMathCalculate).toHaveBeenCalledWith({
      expression: 'x^2',
      operation: 'diff',
      variable: 'x',
    });
  });

  it('falls back safely when calculation fails or reports an error', async () => {
    mocks.runMathCalculate.mockRejectedValueOnce(new Error('private runtime path'));
    await expect(precomputeMathAnswer('求导 x^2')).resolves.toBeNull();

    mocks.runMathCalculate.mockResolvedValueOnce({
      status: 'error',
      result: '',
      steps: [],
      error: 'invalid expression',
    });
    await expect(precomputeMathAnswer('求导 x^2')).resolves.toBeNull();
  });

  it('removes calculate while preserving other authorized tools', () => {
    const tools = {
      calculate: { execute: vi.fn() },
      search_textbook: { execute: vi.fn() },
    };

    expect(withoutCalculateTool(tools)).toEqual({
      search_textbook: tools.search_textbook,
    });
    expect(tools).toHaveProperty('calculate');
  });

  it('builds explicit trusted model context from a precomputed answer', () => {
    const context = buildMathPrecomputeContext({
      expression: 'x^2',
      operation: 'diff',
      variable: 'x',
      result: '2 x',
      steps: [{
        step: 1,
        description: '使用幂函数求导法则',
        operation: 'differentiate_rule',
        input: 'x^2',
        output: '2 x',
      }, {
        step: 2,
        description: '反向积分验证导数',
        operation: 'verify_antiderivative',
        input: '2 x',
        output: 'verified',
      }],
    });

    expect(context).toContain('服务端已用 Mathematica（Wolfram Engine）计算');
    expect(context).toContain('结果与关键中间式已由 Wolfram Engine 计算或验证');
    expect(context).toContain('严格保持上述步骤顺序');
    expect(context).toContain('逐步说明所使用的数学性质或变换规则');
    expect(context).toContain('不得引入 Wolfram 未给出的新等式');
    expect(context).toContain('不得把多个有序步骤压缩成一次跳步');
    expect(context).toContain('可以补充自然语言解释，但显示的数学等式必须来自上述步骤');
    expect(context).toContain('回答第一行必须原样写出：结果与关键中间式已由 Wolfram Engine 计算或验证。');
    expect(context).toContain('所有操作标识以 verify_ 开头的步骤必须完整放入“## 验算”章节');
    expect(context).toContain('不得省略“## 验算”章节');
    expect(context).toContain('答案结束后不要提出继续操作、仿真或追加讲解的问题');
    expect(context).toContain('## 最终答案');
    expect(context).toContain('## 验算');
    expect(context).toContain('第 1 步');
    expect(context).toContain('verify_antiderivative');
    expect(context).toContain('2 x');
  });
});
