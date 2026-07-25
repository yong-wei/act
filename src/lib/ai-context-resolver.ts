/**
 * AI上下文解析器
 *
 * 解析当前页面的AI上下文配置
 * 优先读取页面导出的 aiContextConfig，如不存在则基于路径自动推断
 */

import type {
  AIContextConfig,
  PageContext,
  PageType,
  KnowledgeType,
} from '@/types/ai-context';

/**
 * 自动推断规则配置
 */
interface InferenceRule {
  pattern: RegExp;
  courseId: string;
  courseTitle: string;
  pageType: PageType;
  getStepId?: (pathname: string) => string | undefined;
  getTopic?: (pathname: string) => string;
  getContextExtras?: (pathname: string) => Partial<PageContext>;
  learningObjectives?: string[];
  knowledgeType?: KnowledgeType;
  tools?: string[];
}

function simulationIdFromPath(pathname: string): string {
  const [pathOnly] = pathname.split(/[?#]/, 1);
  const [, simulationId] = pathOnly.split('/').filter(Boolean);
  return simulationId || 'catalog';
}

/**
 * 路径推断规则表
 * 按优先级排序，先匹配的先应用
 */
const INFERENCE_RULES: InferenceRule[] = [
  {
    pattern: /\/interactive-learning\/lesson-(\d+)/,
    courseId: 'lesson-$1',
    courseTitle: '课程 $1',
    pageType: 'theory',
    getStepId: (pathname) => {
      const match = pathname.match(/step-(\d+)/);
      return match ? `step-${match[1]}` : undefined;
    },
    getTopic: (pathname) => '课程学习',
    tools: ['get_lesson_content', 'analyze_concept'],
  },
  {
    pattern: /^\/simulations(?:\/|$)/,
    courseId: 'simulation',
    courseTitle: '船舶控制仿真',
    pageType: 'workspace',
    getStepId: simulationIdFromPath,
    getTopic: () => '船舶控制仿真',
    getContextExtras: (pathname) => ({
      simulationId: simulationIdFromPath(pathname),
      routeProvenance: 'simulation-route',
      runSummaryAvailability: 'unavailable-until-runtime-run',
    }),
    learningObjectives: ['掌握PID控制器调参', '理解船舶运动模型'],
    tools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
  },
  {
    pattern: /\/ai\/copilot/,
    courseId: 'ai-assistant',
    courseTitle: 'AI 助手',
    pageType: 'workspace',
    getTopic: () => 'AI助手工作区',
    tools: ['general_assistance'],
  },
  {
    pattern: /\/interactive-learning\//,
    courseId: 'interactive',
    courseTitle: '互动学习',
    pageType: 'practice',
    getTopic: () => '互动学习',
    tools: ['get_interactive_status', 'provide_guidance'],
  },
];

/**
 * 排除页面路径模式（不显示AI助手）
 */
const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/$/, // 首页
  /^\/(login|register|forgot-password).*$/, // 认证页
  /^\/api\//, // API路由
];

/**
 * 检查路径是否应该排除AI助手
 */
export function isPathExcluded(pathname: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * 基于路径自动推断页面上下文
 */
export function resolveRegisteredAIContextFromPath(pathname: string): Partial<PageContext> | null {
  for (const rule of INFERENCE_RULES) {
    const match = pathname.match(rule.pattern);
    if (match) {
      // 替换变量
      let courseId = rule.courseId;
      let courseTitle = rule.courseTitle;

      // 处理 $1, $2 等占位符
      for (let i = 1; i < match.length; i++) {
        courseId = courseId.replace(`\$${i}`, match[i]);
        courseTitle = courseTitle.replace(`\$${i}`, match[i]);
      }

      return {
        courseId,
        courseTitle,
        pageType: rule.pageType,
        stepId: rule.getStepId?.(pathname) || pathname,
        topic: rule.getTopic?.(pathname) || courseTitle,
        learningObjectives: rule.learningObjectives || [],
        knowledgeType: rule.knowledgeType || 'C',
        url: pathname,
        ...rule.getContextExtras?.(pathname),
      };
    }
  }

  return null;
}

function inferPageContextFromPath(pathname: string): Partial<PageContext> | null {
  const registered = resolveRegisteredAIContextFromPath(pathname);
  if (registered) return registered;

  // 默认推断
  if (pathname !== '/') {
    const pathParts = pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || 'unknown';
    return {
      courseId: lastPart,
      courseTitle: lastPart.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      pageType: 'theory',
      stepId: pathname,
      topic: lastPart.replace(/-/g, ' '),
      learningObjectives: [],
      knowledgeType: 'C',
      url: pathname,
    };
  }

  return null;
}

/**
 * 将AIContextConfig转换为PageContext
 */
function configToPageContext(
  config: AIContextConfig,
  pathname: string
): PageContext {
  return {
    courseId: config.courseId,
    courseTitle: config.courseTitle,
    pageType: config.pageType,
    stepId: config.stepId || pathname,
    topic: config.topic || config.courseTitle,
    learningObjectives: config.learningObjectives || [],
    knowledgeType: config.knowledgeType || 'C',
    url: pathname,
  };
}

/**
 * 解析结果
 */
export interface ResolvedContext {
  pageContext: PageContext | null;
  enabled: boolean;
  tools: string[];
  quickQuestions: Array<{ label: string; question: string }>;
  systemPromptExtension?: string;
}

/**
 * 解析页面AI上下文
 *
 * @param pathname 当前路径
 * @param pageModule 可选的页面模块（用于读取导出的aiContextConfig）
 * @returns 解析后的上下文
 */
export function resolveAIContext(
  pathname: string,
  pageModule?: { aiContextConfig?: AIContextConfig }
): ResolvedContext {
  // 检查是否排除
  if (isPathExcluded(pathname)) {
    return {
      pageContext: null,
      enabled: false,
      tools: [],
      quickQuestions: [],
    };
  }

  // 优先使用显式配置
  if (pageModule?.aiContextConfig) {
    const config = pageModule.aiContextConfig;

    // 检查是否明确禁用
    if (config.enabled === false) {
      return {
        pageContext: null,
        enabled: false,
        tools: [],
        quickQuestions: [],
      };
    }

    // 合并自动推断的上下文（补充缺失的信息）
    const inferred = inferPageContextFromPath(pathname) as Partial<PageContext> & { tools?: string[] } | null;

    return {
      pageContext: configToPageContext(config, pathname),
      enabled: true,
      tools: config.tools || inferred?.tools || [],
      quickQuestions: config.quickQuestions || [],
      systemPromptExtension: config.systemPromptExtension,
    };
  }

  // 使用自动推断
  const inferred = inferPageContextFromPath(pathname) as Partial<PageContext> & { tools?: string[] } | null;

  if (!inferred) {
    return {
      pageContext: null,
      enabled: false,
      tools: [],
      quickQuestions: [],
    };
  }

  return {
    pageContext: inferred as PageContext,
    enabled: true,
    tools: inferred.tools || [],
    quickQuestions: [],
    systemPromptExtension: undefined,
  };
}

/**
 * 异步解析页面AI上下文（支持动态导入）
 */
export async function resolveAIContextAsync(
  pathname: string,
  importPageModule?: () => Promise<{ aiContextConfig?: AIContextConfig }>
): Promise<ResolvedContext> {
  if (isPathExcluded(pathname)) {
    return {
      pageContext: null,
      enabled: false,
      tools: [],
      quickQuestions: [],
    };
  }

  // 尝试动态导入页面模块
  if (importPageModule) {
    try {
      const pageModule = await importPageModule();
      return resolveAIContext(pathname, pageModule);
    } catch {
      // 导入失败，回退到自动推断
    }
  }

  return resolveAIContext(pathname);
}

/**
 * 获取快速问题列表（基于课程ID）
 */
export function getDefaultQuickQuestions(
  courseId?: string
): Array<{ label: string; question: string }> {
  if (!courseId) {
    return [
      { label: '平台介绍', question: '这个平台有哪些功能？' },
      { label: '学习建议', question: '有什么学习建议吗？' },
    ];
  }

  if (courseId.includes('simulation') || courseId.includes('sim')) {
    return [
      { label: '仿真状态', question: '请获取当前的仿真状态' },
      { label: 'PID原理', question: '请解释PID控制器的工作原理' },
      { label: '诺莫托模型', question: '什么是诺莫托船舶模型？' },
      { label: '调参建议', question: '如何调整PID参数？' },
    ];
  }

  if (courseId.includes('lesson')) {
    return [
      { label: '课程概览', question: '这节课的主要内容是什么？' },
      { label: '关键概念', question: '这节课有哪些关键概念？' },
      { label: '学习建议', question: '学习这节课有什么建议？' },
      { label: '实践应用', question: '这些内容如何应用到实践中？' },
    ];
  }

  return [
    { label: '课程介绍', question: '这个课程的主要内容是什么？' },
    { label: '学习重点', question: '这个课程的学习重点是什么？' },
    { label: '疑难解答', question: '这个概念是什么意思？' },
  ];
}
