import { getStepAIContext } from '@/lib/course-ai-contexts';
import { resolveRegisteredAIContextFromPath } from '@/lib/ai-context-resolver';
import type { PageContext } from '@/types/ai-context';

/**
 * AI chat 边界的客户端上下文信任规则（#1885）。
 *
 * `pageContext` 与 legacy `lessonContext` 一律视为不可信请求提示：
 * 只有能被服务端注册表（路由推断规则或课程步骤注册表）解析出的页面
 * 身份才允许进入系统提示词，且进入的字段全部来自服务端投影——浏览器
 * authored 的标题、主题、目标与自由文本不构成系统级指令或授权事实。
 */

export type ServerOwnedChatPageResolution =
  | { ok: true; page: PageContext }
  | { ok: false; code: 'INVALID_AI_CONTEXT' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveServerOwnedChatPageContext(
  pageContext: unknown,
): ServerOwnedChatPageResolution {
  if (!isRecord(pageContext)) return { ok: false, code: 'INVALID_AI_CONTEXT' };

  // 优先用客户端提供的路由路径做注册表解析（注册字段由服务端规则给出）。
  const url = typeof pageContext.url === 'string' ? pageContext.url : '';
  // 路径提示必须是单行合法路径：含换行/控制字符的 instruction 注入直接 fail-closed。
  const urlLooksLikePath = url.startsWith('/') && !/[\r\n\t\u0000-\u001f]/.test(url);
  if (urlLooksLikePath) {
    const registered = resolveRegisteredAIContextFromPath(url);
    if (registered) {
      return { ok: true, page: pageContextFromRegistered(registered, url) };
    }
  }

  // 其次用 (courseId, stepId) 查课程步骤注册表（含互动课键别名归一）。
  const courseId = typeof pageContext.courseId === 'string' ? pageContext.courseId.trim() : '';
  const stepId = typeof pageContext.stepId === 'string' ? pageContext.stepId.trim() : '';
  if (courseId && stepId) {
    const stepContext = getStepAIContext(courseId, stepId);
    if (stepContext) {
      return {
        ok: true,
        page: {
          courseId,
          courseTitle: stepContext.courseTitle ?? '学习页面',
          pageType: stepContext.pageType ?? 'theory',
          stepId,
          topic: stepContext.topic ?? stepId,
          learningObjectives: stepContext.learningObjectives ?? [],
          knowledgeType: stepContext.knowledgeType ?? 'C',
        },
      };
    }
  }

  return { ok: false, code: 'INVALID_AI_CONTEXT' };
}

function pageContextFromRegistered(
  registered: NonNullable<ReturnType<typeof resolveRegisteredAIContextFromPath>>,
  url: string,
): PageContext {
  return {
    courseId: registered.courseId ?? 'unknown',
    courseTitle: registered.courseTitle ?? '学习页面',
    pageType: registered.pageType ?? 'theory',
    stepId: registered.stepId ?? url,
    topic: registered.topic ?? registered.courseTitle ?? '学习页面',
    learningObjectives: registered.learningObjectives ?? [],
    knowledgeType: registered.knowledgeType ?? 'C',
    url,
  };
}
