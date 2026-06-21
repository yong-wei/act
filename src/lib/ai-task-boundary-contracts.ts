import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';

export type AiAuditTaskType =
  | 'global-ai'
  | 'prompt-evaluation'
  | 'report-feedback'
  | 'portfolio-reflection'
  | 'evidence-copilot';

export interface AiAuditTaskContract {
  taskType: AiAuditTaskType;
  contextPolicy: 'student-safe' | 'teacher-review' | 'admin-governance';
  outputTarget: 'answer' | 'prompt-history' | 'practice-candidate' | 'portfolio-draft';
  writebackBehavior: 'none' | 'candidate' | 'draft' | 'explicit-save';
}

export interface AiTaskCandidate {
  id: string;
  title: string;
  detail: string;
  source: string;
  status: 'candidate' | 'draft' | 'ready';
}

const INTERNAL_CONTEXT_PATTERNS = [
  /\bpageContext\b/i,
  /\bknowledgeWorkspace\b/i,
  /\bknowledgeCapabilityContext\b/i,
  /\bcurrentPathId\b/i,
  /\bactiveNodeId\b/i,
  /\bnextNodeIds\b/i,
  /\bkonlingCitationGuard\b/i,
  /\bmodeRuntimeContext\b/i,
  /\bserverContext\b/i,
  /\bmodeClientContextHints\b/i,
  /\bknowledgeWorkspaceHint\b/i,
  /["']?\bresourceId\b["']?\s*:/i,
  /["']?\bcourseId\b["']?\s*:/i,
  /["']?\bpageId\b["']?\s*:/i,
  /["']?\bpathNodeId\b["']?\s*:/i,
  /["']?\bclassId\b["']?\s*:/i,
  /["']?\btargetUserId\b["']?\s*:/i,
  /["']?\bsessionId\b["']?\s*:/i,
  /["']?\bagentSessionId\b["']?\s*:/i,
  /["']?\bteachingAssistantModeId\b["']?\s*:/i,
  /["']?\bmodeContextToken\b["']?\s*:/i,
  /["']?\bregistryId\b["']?\s*:/i,
  /["']?\bgoalId\b["']?\s*:/i,
  /["']?\bgradingRunId\b["']?\s*:/i,
  /["']?\bassetId\b["']?\s*:/i,
  /["']?\brubricId\b["']?\s*:/i,
  /["']?\bassignmentId\b["']?\s*:/i,
  /["']?\bclassReportId\b["']?\s*:/i,
  /["']?\bprepPackId\b["']?\s*:/i,
  /["']?\bselectedNodeId\b["']?\s*:/i,
  /["']?\brequestedNodeId\b["']?\s*:/i,
  /["']?\bcitation\b["']?\s*:/i,
  /["']?\bprovider\b["']?\s*:/i,
];

const HIDDEN_DIAGNOSTIC_MESSAGE = '已隐藏内部上下文诊断。';

export function sanitizeAiVisibleContent(content: string): string {
  if (!content) return content;
  const withoutDiagnosticBlocks = content.replace(/```[a-zA-Z0-9_-]*\s*[\s\S]*?```/g, (block) => (
    INTERNAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(block))
      ? HIDDEN_DIAGNOSTIC_MESSAGE
      : block
  ));
  const sanitized = sanitizePlainTextDiagnostics(withoutDiagnosticBlocks);
  return sanitized.trim() || '已隐藏内部上下文诊断。请根据当前页面任务继续提问。';
}

export function summarizeAiToolResult(toolName: string): string {
  if (toolName.includes('simulation')) return '仿真工具已返回结果，控灵会在回答中解释关键指标。';
  if (toolName.includes('workspace')) return '工作区状态已读取，控灵会保留可见任务上下文。';
  if (toolName.includes('hints')) return '提示工具已返回建议，控灵会转写为学习提示。';
  return '工具结果已进入回答上下文，内部诊断已隐藏。';
}

export function getAiAuditTaskContract(taskType: AiAuditTaskType): AiAuditTaskContract {
  if (taskType === 'prompt-evaluation') {
    return {
      taskType,
      contextPolicy: 'student-safe',
      outputTarget: 'prompt-history',
      writebackBehavior: 'explicit-save',
    };
  }
  if (taskType === 'report-feedback') {
    return {
      taskType,
      contextPolicy: 'student-safe',
      outputTarget: 'practice-candidate',
      writebackBehavior: 'candidate',
    };
  }
  if (taskType === 'portfolio-reflection') {
    return {
      taskType,
      contextPolicy: 'student-safe',
      outputTarget: 'portfolio-draft',
      writebackBehavior: 'draft',
    };
  }
  return {
    taskType,
    contextPolicy: 'student-safe',
    outputTarget: 'answer',
    writebackBehavior: 'none',
  };
}

export function buildAiAuditTaskState(input: {
  taskType: AiAuditTaskType;
  status: AuditedActionState['status'];
  message: string;
  nextAction?: string;
  recoveryAction?: string;
  targetId?: string;
}): AuditedActionState {
  return createAuditedActionState({
    identity: {
      id: `ai-task:${input.taskType}:${input.targetId ?? 'current'}`,
      category: input.status === 'unsupported' ? 'unsupported-action' : 'save',
      label: getAiTaskLabel(input.taskType),
      sourceRoute: getAiTaskSourceRoute(input.taskType),
      targetId: input.targetId,
      requestedAction: input.taskType,
    },
    status: input.status,
    message: input.message,
    nextAction: input.nextAction,
    recoveryAction: input.recoveryAction,
  });
}

export function buildReportFeedbackTaskCandidates(): AiTaskCandidate[] {
  return [
    {
      id: 'practice-control-object',
      title: '复核控制对象和性能指标',
      detail: '把报告反馈中的控制对象、超调量、调节时间和稳态误差重新整理成任务清单。',
      source: 'report-feedback',
      status: 'candidate',
    },
    {
      id: 'practice-evidence-citation',
      title: '补齐证据引用',
      detail: '逐条检查反馈建议是否能回到仿真、作答或评分证据。',
      source: 'report-feedback',
      status: 'candidate',
    },
    {
      id: 'practice-revision-plan',
      title: '形成修订计划',
      detail: '将教师反馈转为可提交的新版本报告结构和验证步骤。',
      source: 'report-feedback',
      status: 'candidate',
    },
  ];
}

export function buildPortfolioReflectionDraft(source: string | null | undefined): AiTaskCandidate {
  return {
    id: `portfolio-reflection-${source || 'copilot'}`,
    title: 'AI 协作反思草稿',
    detail: '记录本次 AI 协作的任务目标、采用建议、保留疑问和下一步验证。',
    source: source || 'copilot',
    status: 'draft',
  };
}

function isInternalContextLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return INTERNAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function sanitizePlainTextDiagnostics(content: string): string {
  const lines = content.split(/\r?\n/);
  const sanitized: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const block = readStructuredBlock(lines, index);
    if (block?.hasInternalContext) {
      sanitized.push(HIDDEN_DIAGNOSTIC_MESSAGE);
      index = block.endIndex;
      continue;
    }

    const line = lines[index];
    if (isInternalContextLine(line)) {
      if (sanitized.at(-1) !== HIDDEN_DIAGNOSTIC_MESSAGE) {
        sanitized.push(HIDDEN_DIAGNOSTIC_MESSAGE);
      }
      continue;
    }
    sanitized.push(line);
  }

  return sanitized.join('\n');
}

function readStructuredBlock(lines: string[], startIndex: number): { endIndex: number; hasInternalContext: boolean } | null {
  const line = lines[startIndex];
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (/^(?:\{|\[)/.test(trimmed)) {
    return readBracketedBlock(lines, startIndex);
  }

  if (isStructuredFieldLine(trimmed) && hasIndentedContinuation(lines, startIndex)) {
    return readIndentedBlock(lines, startIndex);
  }

  return null;
}

function readBracketedBlock(lines: string[], startIndex: number): { endIndex: number; hasInternalContext: boolean } {
  let balance = 0;
  let endIndex = startIndex;
  let hasInternalContext = false;
  let stringQuote: '"' | '\'' | null = null;
  let isEscaped = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const result = countBracketDelta(line, stringQuote, isEscaped);
    balance += result.delta;
    stringQuote = result.stringQuote;
    isEscaped = result.isEscaped;
    hasInternalContext = hasInternalContext || isInternalContextLine(line);
    endIndex = index;
    if (balance <= 0) break;
  }

  return { endIndex, hasInternalContext };
}

function readIndentedBlock(lines: string[], startIndex: number): { endIndex: number; hasInternalContext: boolean } {
  let endIndex = startIndex;
  let hasInternalContext = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      break;
    }
    if (index > startIndex && !isStructuredDiagnosticLine(line, lines[index - 1])) {
      break;
    }
    hasInternalContext = hasInternalContext || isInternalContextLine(line);
    endIndex = index;
  }

  return { endIndex, hasInternalContext };
}

function countBracketDelta(
  line: string,
  initialQuote: '"' | '\'' | null,
  initialEscaped: boolean,
): { delta: number; stringQuote: '"' | '\'' | null; isEscaped: boolean } {
  let delta = 0;
  let stringQuote = initialQuote;
  let isEscaped = initialEscaped;

  for (const char of line) {
    if (stringQuote) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      stringQuote = char;
    } else if (char === '{' || char === '[') {
      delta += 1;
    } else if (char === '}' || char === ']') {
      delta -= 1;
    }
  }

  return { delta, stringQuote, isEscaped };
}

function isStructuredFieldLine(trimmed: string): boolean {
  return /^["']?[\w.-]+["']?\s*:/.test(trimmed) || /^-\s+["']?[\w.-]+["']?\s*:/.test(trimmed);
}

function isStructuredDiagnosticLine(line: string, previousLine: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return (
    isStructuredFieldLine(trimmed)
    || /^[}\]],?$/.test(trimmed)
    || countIndent(line) > countIndent(previousLine)
  );
}

function hasIndentedContinuation(lines: string[], startIndex: number): boolean {
  const startIndent = countIndent(lines[startIndex]);
  const nextLine = lines[startIndex + 1];
  return Boolean(nextLine?.trim()) && countIndent(nextLine) > startIndent;
}

function countIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function getAiTaskLabel(taskType: AiAuditTaskType) {
  if (taskType === 'prompt-evaluation') return 'Prompt 评价';
  if (taskType === 'report-feedback') return '报告反馈 AI 任务';
  if (taskType === 'portfolio-reflection') return '作品集反思草稿';
  if (taskType === 'evidence-copilot') return '证据 Copilot';
  return 'Global AI';
}

function getAiTaskSourceRoute(taskType: AiAuditTaskType) {
  if (taskType === 'prompt-evaluation') return '/evaluation/prompt-assessment';
  if (taskType === 'report-feedback') return '/ai?task=report-feedback';
  if (taskType === 'portfolio-reflection') return '/ai/copilot?context=portfolio-reflection';
  if (taskType === 'evidence-copilot') return '/ai/copilot?context=evidence';
  return '/ai';
}
