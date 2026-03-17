/**
 * 精品课程AI上下文统一注册表
 *
 * 统一管理所有精品互动课程的AI上下文配置
 * 用于全局AI助手框架动态读取当前步骤的上下文
 *
 * 设计原则：
 * 1. 每个步骤都有独立的AIContextConfig
 * 2. 配置包含主题、学习目标、核心概念、快捷问题
 * 3. 学生页面通过当前步骤ID动态获取配置
 * 4. AI助手根据配置生成针对性的系统提示词
 */

import type { AIContextConfig } from '@/types/ai-context';

// L2D课程AI上下文
export {
  L2D_COURSE_META,
  L2D_STEP_AI_CONTEXTS,
  getL2DStepAIContext,
  getL2DStepQuickQuestions,
} from './l2d-ai-contexts';

// LSUM课程AI上下文
export {
  LSUM_COURSE_META,
  LSUM_STEP_AI_CONTEXTS,
  getLSUMStepAIContext,
  getLSUMStepQuickQuestions,
} from './lsum-ai-contexts';

/**
 * 课程AI上下文注册表
 * key: courseId, value: 步骤配置映射
 */
export const COURSE_AI_CONTEXT_REGISTRY: Record<
  string,
  {
    getStepContext: (stepId: string) => AIContextConfig | null;
    getQuickQuestions: (stepId: string) => Array<{ label: string; question: string }>;
    courseMeta: {
      courseId: string;
      courseTitle: string;
      courseDescription: string;
    };
  }
> = {
  // L2D课程
  'l2d-three-domain-linkage-practice': {
    getStepContext: (stepId: string) => {
      const { getL2DStepAIContext } = require('./l2d-ai-contexts');
      return getL2DStepAIContext(stepId);
    },
    getQuickQuestions: (stepId: string) => {
      const { getL2DStepQuickQuestions } = require('./l2d-ai-contexts');
      return getL2DStepQuickQuestions(stepId);
    },
    courseMeta: {
      courseId: 'l2d-three-domain-linkage-practice',
      courseTitle: 'L-2d：三域联动探索 · 平台操作初体验',
      courseDescription:
        '围绕固定三阶系统 G(s)=K/[s(s+1)(s+6)]，在根轨迹、时域和频域三张图中同步拨动增益 K，完成临界增益定位、三域对照表与反思写作。',
    },
  },

  // LSUM课程
  'lsum-design-feasible-domain-v1': {
    getStepContext: (stepId: string) => {
      const { getLSUMStepAIContext } = require('./lsum-ai-contexts');
      return getLSUMStepAIContext(stepId);
    },
    getQuickQuestions: (stepId: string) => {
      const { getLSUMStepQuickQuestions } = require('./lsum-ai-contexts');
      return getLSUMStepQuickQuestions(stepId);
    },
    courseMeta: {
      courseId: 'lsum-design-feasible-domain-v1',
      courseTitle: 'L-sum：设计可行域——让约束成为指南针',
      courseDescription:
        '围绕复平面可行域、根轨迹可行弧段以及时域/频域投影，把"给性能找参数"的设计视角第一次完整搭起来。',
    },
  },
};

/**
 * 根据课程ID和步骤ID获取AI上下文配置
 */
export function getStepAIContext(
  courseId: string,
  stepId: string
): AIContextConfig | null {
  const courseRegistry = COURSE_AI_CONTEXT_REGISTRY[courseId];
  if (!courseRegistry) return null;
  return courseRegistry.getStepContext(stepId);
}

/**
 * 获取步骤的快捷问题列表
 */
export function getStepQuickQuestions(
  courseId: string,
  stepId: string
): Array<{ label: string; question: string }> {
  const courseRegistry = COURSE_AI_CONTEXT_REGISTRY[courseId];
  if (!courseRegistry) return [];
  return courseRegistry.getQuickQuestions(stepId);
}

/**
 * 检查课程是否已注册AI上下文
 */
export function isCourseAIContextRegistered(courseId: string): boolean {
  return courseId in COURSE_AI_CONTEXT_REGISTRY;
}

/**
 * 获取所有已注册的课程ID列表
 */
export function getRegisteredCourseIds(): string[] {
  return Object.keys(COURSE_AI_CONTEXT_REGISTRY);
}
