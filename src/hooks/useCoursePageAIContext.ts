/**
 * 课程页面AI上下文Hook
 *
 * 在精品课程学生页面中使用，根据当前步骤动态更新AI上下文
 * 使全局AI助手能够读取当前步骤的教学内容和目标
 */

'use client';

import { useEffect, useMemo } from 'react';
import type { AIContextConfig, PageContext } from '@/types/ai-context';
import { getStepAIContext } from '@/lib/course-ai-contexts';

interface UseCoursePageAIContextOptions {
  courseId: string;
  stepId: string;
  stepTitle: string;
  stepType: string;
  onContextReady?: (context: AIContextConfig | null) => void;
}

/**
 * 课程页面AI上下文Hook
 *
 * @example
 * ```typescript
 * const step = L2D_LESSON_STEPS[activeIndex];
 * const aiContext = useCoursePageAIContext({
 *   courseId: L2D_LESSON_KEY,
 *   stepId: step.id,
 *   stepTitle: step.title,
 *   stepType: step.pageType,
 * });
 * ```
 */
export function useCoursePageAIContext({
  courseId,
  stepId,
  stepTitle,
  stepType,
  onContextReady,
}: UseCoursePageAIContextOptions): AIContextConfig | null {
  // 获取当前步骤的AI上下文配置
  const stepContext = useMemo(() => {
    return getStepAIContext(courseId, stepId);
  }, [courseId, stepId]);

  // 通知上下文准备就绪
  useEffect(() => {
    if (stepContext && onContextReady) {
      onContextReady(stepContext);
    }
  }, [stepContext, onContextReady]);

  return stepContext;
}

/**
 * 将AIContextConfig转换为PageContext
 * 用于全局AI助手的页面上下文
 */
export function convertToPageContext(
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
 * 获取课程页面的快捷问题列表
 */
export function useCoursePageQuickQuestions(
  courseId: string,
  stepId: string
): Array<{ label: string; question: string }> {
  return useMemo(() => {
    const context = getStepAIContext(courseId, stepId);
    return context?.quickQuestions || [];
  }, [courseId, stepId]);
}

export default useCoursePageAIContext;
