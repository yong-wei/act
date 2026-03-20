/**
 * 分层AI上下文Hook
 *
 * 用于在课程页面中捕获和同步三层AI上下文
 * - Layer 1: 静态语义（步骤配置）
 * - Layer 2: 运行时状态（页面实时状态）
 * - Layer 3: 动态检索（预留）
 *
 * @example
 * ```tsx
 * const { context, refreshContext } = useLayeredAIContext({
 *   courseId: 'l2a-time-domain',
 *   stepId: 'participatory-families-2',
 *   getRuntimeState: async () => ({
 *     pageType: 'practice',
 *     state: { type: 'practice', currentTask: 'find-pole-region', attempts: 3 },
 *     interactionHistory: [],
 *     timestamp: Date.now(),
 *   }),
 * });
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LayeredAIContext,
  RuntimeStateSnapshot,
  StaticSemanticContext,
  RuntimeStateContext,
} from '@/types/ai-context-layered';
import type { PageType } from '@/types/ai-context';
import { getStepAIContext } from '@/lib/course-ai-contexts';

interface UseLayeredAIContextOptions {
  /** 课程ID */
  courseId: string;
  /** 步骤ID */
  stepId: string;
  /** 自定义运行时状态获取函数 */
  getRuntimeState: () => Promise<RuntimeStateSnapshot> | RuntimeStateSnapshot;
  /** 轮询间隔(ms)，0表示禁用轮询 */
  pollInterval?: number;
  /** 是否启用调试日志 */
  debug?: boolean;
}

interface UseLayeredAIContextReturn {
  /** 完整的三层上下文 */
  context: Partial<LayeredAIContext>;
  /** 静态语义层 */
  staticContext?: StaticSemanticContext;
  /** 运行时状态层 */
  runtimeContext?: RuntimeStateContext;
  /** 手动刷新上下文 */
  refreshContext: () => Promise<void>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 分层AI上下文Hook
 */
export function useLayeredAIContext(
  options: UseLayeredAIContextOptions
): UseLayeredAIContextReturn {
  const { courseId, stepId, getRuntimeState, pollInterval = 5000, debug = false } = options;

  const [context, setContext] = useState<Partial<LayeredAIContext>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useLayeredAIContext]', ...args);
      }
    },
    [debug]
  );

  /**
   * 加载静态语义上下文
   */
  const loadStaticContext = useCallback(async () => {
    try {
      const stepConfig = getStepAIContext(courseId, stepId);

      if (stepConfig) {
        const staticContext: StaticSemanticContext = {
          courseMeta: {
            courseId,
            courseTitle: stepConfig.courseTitle,
            courseDescription: '',
            keyConcepts: stepConfig.tools || [],
          },
          stepMeta: {
            stepId,
            stepType: stepConfig.pageType,
            topic: stepConfig.topic || stepConfig.courseTitle,
            learningObjectives: stepConfig.learningObjectives || [],
            knowledgeType: stepConfig.knowledgeType || 'C',
          },
          pedagogicalIntent: {
            focus: stepConfig.systemPromptExtension || '',
            commonMisconceptions: [],
            suggestedScaffolds: [],
          },
          knowledgePoints: [],
        };

        if (mountedRef.current) {
          setContext((prev) => ({
            ...prev,
            static: staticContext,
          }));
        }

        log('Static context loaded', { courseId, stepId });
      } else {
        log('No step config found', { courseId, stepId });
      }
    } catch (error) {
      console.error('Failed to load static context:', error);
    }
  }, [courseId, stepId, log]);

  /**
   * 刷新运行时上下文
   */
  const refreshContext = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);

    try {
      // 获取运行时状态
      const runtimeSnapshot = await getRuntimeState();

      if (!mountedRef.current) return;

      // 构建运行时上下文
      const runtimeContext: RuntimeStateContext = {
        pageType: runtimeSnapshot.pageType,
        pageState: runtimeSnapshot.state,
        interactionHistory: runtimeSnapshot.interactionHistory,
        focusedElements: runtimeSnapshot.focusedElements,
        timestamp: runtimeSnapshot.timestamp,
        sessionDuration: runtimeSnapshot.sessionDuration || 0,
      };

      if (mountedRef.current) {
        setContext((prev) => ({
          ...prev,
          runtime: runtimeContext,
        }));
        setLastUpdated(Date.now());
      }

      log('Runtime context refreshed', {
        pageType: runtimeSnapshot.pageType,
        sessionDuration: runtimeContext.sessionDuration,
      });
    } catch (error) {
      console.error('Failed to refresh AI context:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [getRuntimeState, log]);

  /**
   * 初始化静态上下文（步骤切换时加载一次）
   */
  useEffect(() => {
    mountedRef.current = true;

    loadStaticContext();

    return () => {
      mountedRef.current = false;
    };
  }, [courseId, stepId, loadStaticContext]);

  /**
   * 启动运行时状态轮询
   */
  useEffect(() => {
    // 立即执行一次
    refreshContext();

    // 设置轮询
    if (pollInterval > 0) {
      pollRef.current = setInterval(refreshContext, pollInterval);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [refreshContext, pollInterval]);

  return {
    context,
    staticContext: context.static,
    runtimeContext: context.runtime,
    refreshContext,
    isLoading,
    lastUpdated,
  };
}

/**
 * 简化版Hook - 仅获取静态上下文
 */
export function useStaticAIContext(courseId: string, stepId: string) {
  const [staticContext, setStaticContext] = useState<StaticSemanticContext | undefined>();

  useEffect(() => {
    const stepConfig = getStepAIContext(courseId, stepId);

    if (stepConfig) {
      setStaticContext({
        courseMeta: {
          courseId,
          courseTitle: stepConfig.courseTitle,
          courseDescription: '',
          keyConcepts: stepConfig.tools || [],
        },
        stepMeta: {
          stepId,
          stepType: stepConfig.pageType,
          topic: stepConfig.topic || stepConfig.courseTitle,
          learningObjectives: stepConfig.learningObjectives || [],
          knowledgeType: stepConfig.knowledgeType || 'C',
        },
        pedagogicalIntent: {
          focus: stepConfig.systemPromptExtension || '',
          commonMisconceptions: [],
          suggestedScaffolds: [],
        },
        knowledgePoints: [],
      });
    }
  }, [courseId, stepId]);

  return staticContext;
}

/**
 * 创建运行时状态快照的辅助函数
 */
export function createRuntimeSnapshot(
  pageType: PageType,
  state: RuntimeStateSnapshot['state'],
  options: {
    interactionHistory?: RuntimeStateSnapshot['interactionHistory'];
    sessionDuration?: number;
    focusedElements?: string[];
  } = {}
): RuntimeStateSnapshot {
  return {
    pageType,
    state,
    interactionHistory: options.interactionHistory || [],
    timestamp: Date.now(),
    sessionDuration: options.sessionDuration || 0,
    focusedElements: options.focusedElements,
  };
}
