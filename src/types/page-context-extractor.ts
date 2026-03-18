/**
 * 页面上下文提取器接口定义
 *
 * 每个页面类型实现此接口以提供运行时状态
 */

import type {
  StaticSemanticContext,
  RuntimeStateContext,
  LayeredAIContext,
  AssembleOptions,
} from './ai-context-layered';
import type { PageType } from './ai-context';

/**
 * 页面上下文提取器接口
 * 每个页面类型实现此接口以提供运行时状态
 */
export interface PageContextExtractor<TState = unknown> {
  /** 提取器唯一标识 */
  readonly id: string;

  /** 支持的页面类型 */
  readonly pageType: PageType;

  /**
   * 提取静态语义上下文
   * 从课程配置中读取
   */
  extractSemantic(stepId: string): Promise<StaticSemanticContext>;

  /**
   * 提取运行时状态
   * 从页面当前状态中读取
   */
  extractRuntime(state: TState): RuntimeStateContext;

  /**
   * 获取优先级字段列表
   * 用于Token限制时的裁剪决策
   * 按优先级从高到低排序
   */
  getPriorityFields(): string[];

  /**
   * 序列化为结构化字符串
   * 用于注入LLM Prompt
   */
  serialize(context: LayeredAIContext): string;
}

/**
 * 提取器注册表
 */
export interface ExtractorRegistry {
  register(extractor: PageContextExtractor): void;
  unregister(extractorId: string): void;
  getExtractor(pageType: PageType): PageContextExtractor | undefined;
  getAllExtractors(): PageContextExtractor[];
}

/**
 * 提取器注册表实现
 */
export class ExtractorRegistryImpl implements ExtractorRegistry {
  private extractors = new Map<string, PageContextExtractor>();
  private pageTypeIndex = new Map<PageType, string>();

  register(extractor: PageContextExtractor): void {
    this.extractors.set(extractor.id, extractor);
    this.pageTypeIndex.set(extractor.pageType, extractor.id);
  }

  unregister(extractorId: string): void {
    const extractor = this.extractors.get(extractorId);
    if (extractor) {
      this.extractors.delete(extractorId);
      this.pageTypeIndex.delete(extractor.pageType);
    }
  }

  getExtractor(pageType: PageType): PageContextExtractor | undefined {
    const extractorId = this.pageTypeIndex.get(pageType);
    if (extractorId) {
      return this.extractors.get(extractorId);
    }
    return undefined;
  }

  getAllExtractors(): PageContextExtractor[] {
    return Array.from(this.extractors.values());
  }
}

/**
 * 提取器元数据
 */
export interface ExtractorMetadata {
  id: string;
  pageType: PageType;
  name: string;
  description: string;
  version: string;
}

/**
 * 序列化选项
 */
export interface SerializeOptions extends AssembleOptions {
  /** 是否包含静态层 */
  includeStatic?: boolean;
  /** 是否包含运行时层 */
  includeRuntime?: boolean;
  /** 是否包含检索层 */
  includeRetrieval?: boolean;
  /** 自定义格式化器 */
  formatter?: (context: LayeredAIContext) => string;
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
