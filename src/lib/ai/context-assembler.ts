/**
 * 上下文组装器
 *
 * 负责将三层上下文组装为最终的LLM Prompt
 * 支持Token预算管理和优先级裁剪
 */

import type {
  LayeredAIContext,
  StaticSemanticContext,
  RuntimeStateContext,
  DynamicRetrievalContext,
  PageSpecificState,
  AssembleOptions,
} from '@/types/ai-context-layered';
import type { PageContextExtractor, SerializeOptions } from '@/types/page-context-extractor';
import type { PageType } from '@/types/ai-context';
import { getStepAIContext } from '@/lib/course-ai-contexts';

/**
 * 估计文本的Token数量（粗略估算：1 token ≈ 4字符）
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 根据路径获取字段值
 */
function getFieldByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 上下文组装器
 * 负责将三层上下文组装为最终的LLM Prompt
 */
export class ContextAssembler {
  private extractors = new Map<PageType, PageContextExtractor>();
  private defaultTokenBudget = 4000;

  /**
   * 注册提取器
   */
  registerExtractor(extractor: PageContextExtractor): void {
    this.extractors.set(extractor.pageType, extractor);
  }

  /**
   * 注销提取器
   */
  unregisterExtractor(pageType: PageType): void {
    this.extractors.delete(pageType);
  }

  /**
   * 获取已注册的提取器
   */
  getExtractor(pageType: PageType): PageContextExtractor | undefined {
    return this.extractors.get(pageType);
  }

  /**
   * 组装完整上下文
   */
  async assemble(
    courseId: string,
    stepId: string,
    runtimeState: unknown,
    options: AssembleOptions = {}
  ): Promise<LayeredAIContext> {
    const { enableRetrieval = false } = options;

    // Layer 1: 获取静态语义
    const staticContext = await this.fetchStaticSemantic(courseId, stepId);

    // Layer 2: 提取运行时状态
    const runtimeContext = await this.extractRuntime(staticContext.stepMeta.stepType, runtimeState);

    // Layer 3: 动态检索（预留）
    const retrievalContext = enableRetrieval
      ? await this.performRetrieval(staticContext, runtimeContext)
      : this.createEmptyRetrievalContext();

    return {
      static: staticContext,
      runtime: runtimeContext,
      retrieval: retrievalContext,
    };
  }

  /**
   * 获取静态语义上下文
   */
  private async fetchStaticSemantic(courseId: string, stepId: string): Promise<StaticSemanticContext> {
    // 从现有配置系统中读取
    const stepConfig = getStepAIContext(courseId, stepId);

    return {
      courseMeta: {
        courseId,
        courseTitle: stepConfig?.courseTitle || '未知课程',
        courseDescription: '',
        keyConcepts: stepConfig?.tools || [],
      },
      stepMeta: {
        stepId,
        stepType: stepConfig?.pageType || 'theory',
        topic: stepConfig?.topic || stepConfig?.courseTitle || '未知步骤',
        learningObjectives: stepConfig?.learningObjectives || [],
        knowledgeType: stepConfig?.knowledgeType || 'C',
      },
      pedagogicalIntent: {
        focus: stepConfig?.systemPromptExtension || '',
        commonMisconceptions: [],
        suggestedScaffolds: [],
      },
      knowledgePoints: [],
    };
  }

  /**
   * 提取运行时状态
   */
  private async extractRuntime(pageType: PageType, state: unknown): Promise<RuntimeStateContext> {
    const extractor = this.extractors.get(pageType);

    if (!extractor) {
      // 无提取器时返回基础运行时上下文
      return {
        pageType: pageType,
        pageState: { type: pageType } as PageSpecificState,
        interactionHistory: [],
        timestamp: Date.now(),
        sessionDuration: 0,
      };
    }

    return extractor.extractRuntime(state);
  }

  /**
   * 执行动态检索（预留接口）
   */
  private async performRetrieval(
    _staticCtx: StaticSemanticContext,
    _runtimeCtx: RuntimeStateContext
  ): Promise<DynamicRetrievalContext> {
    // TODO: 接入向量检索
    return {
      relatedFragments: [],
      personalizedHints: [],
      predictedMisconceptions: _staticCtx.pedagogicalIntent.commonMisconceptions,
    };
  }

  /**
   * 创建空的检索上下文
   */
  private createEmptyRetrievalContext(): DynamicRetrievalContext {
    return {
      relatedFragments: [],
      personalizedHints: [],
      predictedMisconceptions: [],
    };
  }

  /**
   * 将上下文序列化为Prompt
   */
  serializeToPrompt(context: LayeredAIContext, options: SerializeOptions = {}): string {
    const opts = { ...DEFAULT_SERIALIZE_OPTIONS, ...options };

    // 如果有自定义格式化器，使用它
    if (opts.formatter) {
      return opts.formatter(context);
    }

    // 使用对应提取器的序列化方法
    const extractor = this.extractors.get(context.runtime.pageType);
    if (extractor) {
      return extractor.serialize(context);
    }

    // 默认序列化逻辑
    return this.defaultSerialize(context, opts);
  }

  /**
   * 默认序列化逻辑
   */
  private defaultSerialize(context: LayeredAIContext, options: SerializeOptions): string {
    const parts: string[] = [];

    if (options.includeStatic !== false) {
      const { static: s } = context;
      parts.push(`【当前课程】${s.courseMeta.courseTitle}`);
      parts.push(`【当前步骤】${s.stepMeta.topic}`);
      if (s.stepMeta.learningObjectives.length > 0) {
        parts.push(`【学习目标】${s.stepMeta.learningObjectives.join('；')}`);
      }
      parts.push(`【页面类型】${s.stepMeta.stepType}`);
    }

    if (options.includeRuntime !== false) {
      const { runtime: r } = context;
      parts.push(`【会话时长】${Math.floor(r.sessionDuration / 60)}分钟`);
      parts.push(`【交互次数】${r.interactionHistory.length}次`);
    }

    return parts.join('\n');
  }

  /**
   * 根据Token预算裁剪上下文
   */
  trimContextByBudget(context: LayeredAIContext, tokenBudget: number): LayeredAIContext {
    const extractor = this.extractors.get(context.runtime.pageType);
    const priorityFields = extractor?.getPriorityFields() || this.getDefaultPriorityFields();

    let serialized = this.serializeToPrompt(context);
    let currentTokens = estimateTokens(serialized);

    // 如果未超过预算，直接返回
    if (currentTokens <= tokenBudget) {
      return context;
    }

    // 创建可修改的上下文副本
    const trimmedContext: LayeredAIContext = JSON.parse(JSON.stringify(context));

    // 按优先级从低到高裁剪字段
    const fieldPriorityMap = new Map<string, number>();
    priorityFields.forEach((field, index) => {
      fieldPriorityMap.set(field, index);
    });

    // 计算需要裁剪的token数
    let tokensToTrim = currentTokens - tokenBudget;

    // 从低优先级字段开始裁剪
    for (let i = priorityFields.length - 1; i >= 0 && tokensToTrim > 0; i--) {
      const fieldPath = priorityFields[i];
      const value = getFieldByPath(trimmedContext, fieldPath);

      if (value !== undefined && value !== null) {
        const fieldTokens = estimateTokens(JSON.stringify(value));

        // 移除该字段
        this.removeFieldByPath(trimmedContext, fieldPath);
        tokensToTrim -= fieldTokens;
      }
    }

    return trimmedContext;
  }

  /**
   * 获取默认优先级字段列表
   */
  private getDefaultPriorityFields(): string[] {
    return [
      'static.stepMeta.learningObjectives',
      'static.pedagogicalIntent.focus',
      'runtime.pageState',
      'runtime.interactionHistory',
      'static.pedagogicalIntent.commonMisconceptions',
      'static.pedagogicalIntent.suggestedScaffolds',
      'static.knowledgePoints',
      'retrieval.relatedFragments',
      'retrieval.personalizedHints',
    ];
  }

  /**
   * 根据路径移除字段
   */
  private removeFieldByPath(obj: unknown, path: string): void {
    const parts = path.split('.');
    const lastPart = parts.pop();

    if (!lastPart) return;

    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return;
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current !== null && current !== undefined) {
      delete (current as Record<string, unknown>)[lastPart];
    }
  }
}

/**
 * 默认序列化选项
 */
export const DEFAULT_SERIALIZE_OPTIONS: SerializeOptions = {
  includeStatic: true,
  includeRuntime: true,
  includeRetrieval: false,
  tokenBudget: 4000,
};

// 单例实例
export const contextAssembler = new ContextAssembler();
