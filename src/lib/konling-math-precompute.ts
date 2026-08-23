import {
  runMathCalculate,
  type MathCalculateStep,
  type MathCalcOperation,
} from '@/lib/math-calc';

export interface DetectedMathRequest {
  expression: string;
  operation: MathCalcOperation;
  variable: string;
}

export interface PrecomputedMathAnswer extends DetectedMathRequest {
  result: string;
  steps: MathCalculateStep[];
}

const OPERATION_PATTERNS: ReadonlyArray<readonly [MathCalcOperation, RegExp]> = [
  ['inverse_laplace', /拉普拉斯逆变换|逆拉普拉斯|反拉普拉斯/i],
  ['laplace', /拉普拉斯变换|laplace\s*transform/i],
  ['apart', /部分分式|partial\s*fraction/i],
  ['factor', /因式分解|factor(?:ize)?/i],
  ['expand', /展开|expand/i],
  ['diff', /求导|导数|微分|differentiat/i],
  ['integrate', /积分|integrat/i],
  ['simplify', /化简|simplif/i],
];

const REQUEST_PREFIX_PATTERNS = [
  /^\s*(?:请|麻烦|帮我|计算|求|对)?\s*(?:化简|展开|因式分解|部分分式展开?|求导|导数|微分|积分)\s*/i,
  /^\s*(?:请|麻烦|帮我)?\s*求?\s*/i,
];

const TRAILING_OPERATION_PATTERN = /\s*(?:的)?\s*(?:拉普拉斯逆变换|逆拉普拉斯变换?|反拉普拉斯变换?|拉普拉斯变换|部分分式展开?|因式分解|化简|展开|求导|导数|微分|积分)(?:[\s，,。！？!?][\s\S]*)?$/i;

function normalizeMathExpression(expression: string): string {
  return expression
    .trim()
    .replace(/^[$]+|[$]+$/g, '')
    .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '')
    .replace(/(\d)([A-Za-z])/g, '$1*$2')
    .replace(/\)(?=\()/g, ')*')
    .replace(/\)(?=[A-Za-z0-9])/g, ')*');
}

function inferVariable(expression: string, operation: MathCalcOperation): string {
  if (operation === 'inverse_laplace' || operation === 'apart') return 's';
  if (operation === 'laplace') return 't';
  const withoutLatexCommands = expression.replace(/\\[A-Za-z]+/g, '');
  return withoutLatexCommands.match(/[A-Za-z]/)?.[0] ?? 'x';
}

function extractExpression(text: string, operation: MathCalcOperation): string | null {
  let candidate = text.trim();
  const assignmentIndex = candidate.indexOf('=');
  if (assignmentIndex >= 0) {
    candidate = candidate.slice(assignmentIndex + 1);
  } else {
    for (const pattern of REQUEST_PREFIX_PATTERNS) {
      candidate = candidate.replace(pattern, '');
    }
  }

  candidate = candidate
    .replace(TRAILING_OPERATION_PATTERN, '')
    .replace(/\s*(?:的)?\s*(?:结果|表达式|形式|导数|积分)\s*[。！？!?]*$/i, '')
    .replace(/[，。！？!?][\s\S]*$/, '')
    .trim();

  const normalized = normalizeMathExpression(candidate);
  if (!normalized || normalized.length > 300) return null;
  if (!/^[A-Za-z0-9+\-*/^().,\\{}\[\]]+$/.test(normalized)) return null;
  if (!/[A-Za-z0-9]/.test(normalized)) return null;

  if (operation === 'laplace' && normalized.toLowerCase().startsWith('laplace')) return null;
  return normalized;
}

export function inferOperation(text: string): MathCalcOperation | null {
  return OPERATION_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function detectMathRequest(userMessage: string): DetectedMathRequest | null {
  const operation = inferOperation(userMessage);
  if (!operation) return null;
  const expression = extractExpression(userMessage, operation);
  if (!expression) return null;
  return {
    expression,
    operation,
    variable: inferVariable(expression, operation),
  };
}

export async function precomputeMathAnswer(userMessage: string): Promise<PrecomputedMathAnswer | null> {
  const request = detectMathRequest(userMessage);
  if (!request) return null;

  try {
    const response = await runMathCalculate(request);
    if (response.status !== 'ok') return null;
    return {
      ...request,
      result: response.result,
      steps: response.steps,
    };
  } catch {
    return null;
  }
}

export function buildMathPrecomputeContext(answer: PrecomputedMathAnswer): string {
  const orderedSteps = answer.steps.map((step) => [
    `第 ${step.step} 步：${step.description}`,
    `- 操作标识：${step.operation}`,
    `- 输入：${step.input}`,
    `- 输出：${step.output}`,
  ].join('\n')).join('\n');

  return [
    '服务端已用 Mathematica（Wolfram Engine）计算以下数学问题。',
    '结果与关键中间式已由 Wolfram Engine 计算或验证。',
    `表达式：${answer.expression}`,
    `操作：${answer.operation}`,
    `结果（LaTeX）：${answer.result}`,
    'Wolfram 给出的有序计算步骤：',
    orderedSteps || '未提供可展开的中间步骤。',
    '',
    '回答要求：',
    '1. 严格保持上述步骤顺序，不得省略关键中间式。',
    '2. 逐步说明所使用的数学性质或变换规则，并把 Wolfram 的英文步骤说明翻译成准确中文。',
    '3. 不得引入 Wolfram 未给出的新等式、系数、极点、条件或计算结论。',
    '4. 不得把多个有序步骤压缩成一次跳步；每一步都要分别解释输入如何变成输出。',
    '5. 可以补充自然语言解释，但显示的数学等式必须来自上述步骤。',
    '6. 如果步骤较少，说明该题可直接完成；不要为了增加篇幅虚构步骤。',
    '7. 如果验算步骤是 conditional、unresolved 或 failed，必须如实说明，不能表述为无条件验证通过。',
    '8. 回答第一行必须原样写出：结果与关键中间式已由 Wolfram Engine 计算或验证。',
    '9. 所有操作标识以 verify_ 开头的步骤必须完整放入“## 验算”章节；不得省略“## 验算”章节。',
    '10. 答案结束后不要提出继续操作、仿真或追加讲解的问题。',
    '11. 使用以下章节组织答案，章节名称不得改写或省略：',
    '## 解题思路',
    '## 详细过程',
    '## 最终答案',
    '## 验算',
  ].join('\n');
}

export function withoutCalculateTool<T>(tools: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(tools).filter(([toolName]) => toolName !== 'calculate'),
  );
}
