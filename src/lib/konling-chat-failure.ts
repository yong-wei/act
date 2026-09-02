export type KonlingChatFailureCategory =
  | 'auth-required'
  | 'conversation-missing'
  | 'task-context-invalid'
  | 'state-conflict'
  | 'rate-limited'
  | 'service-unavailable'
  | 'network-unavailable'
  | 'unknown';

export interface KonlingChatFailure {
  category: KonlingChatFailureCategory;
  message: string;
}

const KONLING_CHAT_FAILURE_COPY: Record<KonlingChatFailureCategory, string> = {
  'auth-required': '登录状态已失效，请重新登录后再继续。',
  'conversation-missing': '当前会话已不存在，请刷新会话或开启新对话。',
  'task-context-invalid': '当前任务状态已变化，请刷新任务状态后重试。',
  'state-conflict': '当前会话状态已变化，请刷新后重试。',
  'rate-limited': '提问过于频繁，请稍后再试。',
  'service-unavailable': '智能助手暂时无法完成请求，请稍后再试。',
  'network-unavailable': '网络连接不可用，请检查网络后重试。',
  unknown: '智能助手暂时无法完成请求，请稍后再试。',
};

// 服务端稳定错误码 -> 失败类别；未知码 fail closed 为 unknown，不回退原始文本。
const KONLING_CHAT_FAILURE_CODES: Record<string, KonlingChatFailureCategory> = {
  AI_SERVICE_UNAVAILABLE: 'service-unavailable',
  KONLING_MODE_UNAVAILABLE: 'service-unavailable',
  INVALID_AI_TASK_CONTEXT: 'task-context-invalid',
  INTERACTIVE_AI_RESOURCE_MISMATCH: 'task-context-invalid',
  UNAUTHORIZED: 'auth-required',
  CONVERSATION_NOT_FOUND: 'conversation-missing',
  SESSION_NOT_FOUND: 'conversation-missing',
  RATE_LIMITED: 'rate-limited',
};

const KONLING_CHAT_FAILURE_STATUS: Record<number, KonlingChatFailureCategory> = {
  400: 'task-context-invalid',
  401: 'auth-required',
  404: 'conversation-missing',
  409: 'state-conflict',
  429: 'rate-limited',
  500: 'service-unavailable',
  502: 'service-unavailable',
  503: 'service-unavailable',
  504: 'service-unavailable',
};

// 未经共享传输边界的历史错误文本启发式：仅用于归类，原文永不进入学生界面。
const KONLING_CHAT_FAILURE_TEXT_HINTS: Array<[RegExp, KonlingChatFailureCategory]> = [
  [/failed to fetch|fetch failed|networkerror|load failed|err_(?:failed|network|connection)/i, 'network-unavailable'],
  [/conversation not found|session not found/i, 'conversation-missing'],
  [/unauthorized|未授权/i, 'auth-required'],
  [/invalid_ai_task_context|missing messages/i, 'task-context-invalid'],
  [/conflict|active turn/i, 'state-conflict'],
];

export function konlingChatFailureCopy(category: KonlingChatFailureCategory): string {
  return KONLING_CHAT_FAILURE_COPY[category];
}

function parseStableErrorCode(bodyText: string): string | null {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const code = (parsed as Record<string, unknown>).error;
      if (typeof code === 'string' && code.length > 0 && code.length <= 64) return code;
    }
  } catch {
    // 非 JSON 正文按状态分类
  }
  return null;
}

export function classifyKonlingChatFailure(status: number | null, bodyText: string): KonlingChatFailureCategory {
  const code = parseStableErrorCode(bodyText);
  if (code && code in KONLING_CHAT_FAILURE_CODES) return KONLING_CHAT_FAILURE_CODES[code];
  if (status !== null && status in KONLING_CHAT_FAILURE_STATUS) return KONLING_CHAT_FAILURE_STATUS[status];
  return 'unknown';
}

export class KonlingChatFailureError extends Error {
  readonly konlingChatFailure: KonlingChatFailure;

  constructor(category: KonlingChatFailureCategory) {
    super(konlingChatFailureCopy(category));
    this.name = 'KonlingChatFailureError';
    this.konlingChatFailure = { category, message: this.message };
  }
}

export function normalizeKonlingChatFailure(error: unknown): KonlingChatFailure {
  if (error && typeof error === 'object' && 'konlingChatFailure' in error) {
    const failure = (error as { konlingChatFailure: unknown }).konlingChatFailure;
    if (failure && typeof failure === 'object' && typeof (failure as KonlingChatFailure).category === 'string') {
      return failure as KonlingChatFailure;
    }
  }
  const message = error instanceof Error ? error.message : '';
  for (const [pattern, category] of KONLING_CHAT_FAILURE_TEXT_HINTS) {
    if (pattern.test(message)) return { category, message: konlingChatFailureCopy(category) };
  }
  // 未经归一化的 SDK 错误可能把整个 JSON 响应体塞进 message
  const code = parseStableErrorCode(message);
  if (code && code in KONLING_CHAT_FAILURE_CODES) {
    const category = KONLING_CHAT_FAILURE_CODES[code];
    return { category, message: konlingChatFailureCopy(category) };
  }
  return { category: 'unknown', message: konlingChatFailureCopy('unknown') };
}

// 共享传输边界：非 2xx 与网络异常都转换为学生安全失败错误，
// 使所有直接渲染 error.message 的消费面自动脱敏。
export function createKonlingSafeFetch(onResponse?: (response: Response) => void): typeof fetch {
  return async (input, init) => {
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch {
      throw new KonlingChatFailureError('network-unavailable');
    }
    onResponse?.(response.clone());
    if (!response.ok) {
      const bodyText = await response.clone().text().catch(() => '');
      throw new KonlingChatFailureError(classifyKonlingChatFailure(response.status, bodyText));
    }
    return response;
  };
}
