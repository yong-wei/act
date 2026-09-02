import { getStepAIContext } from '@/lib/course-ai-contexts';
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

  // 仅接受课程步骤注册表精确命中（含互动课键别名归一）：路由 url 的宽泛
  // 前缀推断会把客户端选择的虚假页面身份写进系统提示词，不得作为身份来源。
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

