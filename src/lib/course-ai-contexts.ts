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
import {
  getUnit21StepAIContext as getUnit21StepAIContextLocal,
  getUnit21StepQuickQuestions as getUnit21StepQuickQuestionsLocal,
} from './unit-2-1-ai-contexts';
import {
  getUnit13StepAIContext as getUnit13StepAIContextLocal,
  getUnit13StepQuickQuestions as getUnit13StepQuickQuestionsLocal,
} from './unit-1-3-ai-contexts';

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

// 2-1 课程 AI 上下文
export {
  UNIT_2_1_COURSE_META,
  UNIT_2_1_STEP_AI_CONTEXTS,
  getUNIT_2_1StepAIContext,
  getUNIT_2_1StepQuickQuestions,
  getUnit21StepAIContext,
  getUnit21StepQuickQuestions,
} from './unit-2-1-ai-contexts';

// 1-1 课程 AI 上下文
export {
  UNIT_1_1_COURSE_META,
  UNIT_1_1_STEP_AI_CONTEXTS,
  getUNIT_1_1StepAIContext,
  getUNIT_1_1StepQuickQuestions,
  getUnit11StepAIContext,
  getUnit11StepQuickQuestions,
} from './unit-1-1-ai-contexts';

// 1-2 课程 AI 上下文
export {
  UNIT_1_2_COURSE_META,
  UNIT_1_2_STEP_AI_CONTEXTS,
  getUNIT_1_2StepAIContext,
  getUNIT_1_2StepQuickQuestions,
  getUnit12StepAIContext,
  getUnit12StepQuickQuestions,
} from './unit-1-2-ai-contexts';

// 1-3 课程 AI 上下文
export {
  UNIT_1_3_COURSE_META,
  UNIT_1_3_STEP_AI_CONTEXTS,
  getUNIT_1_3StepAIContext,
  getUNIT_1_3StepQuickQuestions,
  getUnit13StepAIContext,
  getUnit13StepQuickQuestions,
} from './unit-1-3-ai-contexts';

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

  'unit-2-1-modeling-language-v1': {
    getStepContext: (stepId: string) => getUnit21StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit21StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-2-1-modeling-language-v1',
      courseTitle: '2-1：建模与变换语言——从真实对象到统一分析对象',
      courseDescription:
        '围绕拉氏变换工程动机、零初值传递函数、典型环节、结构图、信号流图与梅森公式，建立模块 2 的统一对象语言。',
    },
  },

  'unit-1-3-time-domain-response-v1': {
    getStepContext: (stepId: string) => getUnit13StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit13StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-1-3-time-domain-response-v1',
      courseTitle: '2-2：时域响应基础——从响应曲线到动态性能指标',
      courseDescription:
        '围绕单位阶跃响应、一阶与二阶系统标准型及四个关键时域指标，建立从响应曲线到动态品质判断的第一套语言。',
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
