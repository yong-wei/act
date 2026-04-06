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
  getUnit22StepAIContext as getUnit22StepAIContextLocal,
  getUnit22StepQuickQuestions as getUnit22StepQuickQuestionsLocal,
} from './unit-2-2-ai-contexts';
import {
  getUnit23StepAIContext as getUnit23StepAIContextLocal,
  getUnit23StepQuickQuestions as getUnit23StepQuickQuestionsLocal,
} from './unit-2-3-ai-contexts';

// 2-1 课程 AI 上下文
export {
  UNIT_2_1_COURSE_META,
  UNIT_2_1_STEP_AI_CONTEXTS,
  getUNIT_2_1StepAIContext,
  getUNIT_2_1StepQuickQuestions,
  getUnit21StepAIContext,
  getUnit21StepQuickQuestions,
} from './unit-2-1-ai-contexts';

// 2-2 课程 AI 上下文
export {
  UNIT_2_2_COURSE_META,
  UNIT_2_2_STEP_AI_CONTEXTS,
  getUNIT_2_2StepAIContext,
  getUNIT_2_2StepQuickQuestions,
  getUnit22StepAIContext,
  getUnit22StepQuickQuestions,
} from './unit-2-2-ai-contexts';

// 2-3 课程 AI 上下文
export {
  UNIT_2_3_COURSE_META,
  UNIT_2_3_STEP_AI_CONTEXTS,
  getUNIT_2_3StepAIContext,
  getUNIT_2_3StepQuickQuestions,
  getUnit23StepAIContext,
  getUnit23StepQuickQuestions,
} from './unit-2-3-ai-contexts';

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

  'unit-2-2-time-domain-response-v1': {
    getStepContext: (stepId: string) => getUnit22StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit22StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-2-2-time-domain-response-v1',
      courseTitle: '2-2：时域响应基础——从响应曲线到动态性能指标',
      courseDescription:
        '围绕单位阶跃响应、一阶与二阶系统标准型及四个关键时域指标，建立从响应曲线到动态品质判断的第一套语言。',
    },
  },

  'unit-2-3-frequency-response-bode-intro-v1': {
    getStepContext: (stepId: string) => getUnit23StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit23StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-2-3-frequency-response-bode-intro-v1',
      courseTitle: '2-3：频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
      courseDescription:
        '围绕频率分量思想、正弦稳态响应、G(jω)、幅频/相频语言与 Bode 首轮骨架，完成从时域现象到频域图形对象的第一轮切换。',
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
