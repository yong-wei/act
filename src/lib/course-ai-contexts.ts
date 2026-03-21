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

  'unit-1-1-laplace-transfer-function-v1': {
    getStepContext: (stepId: string) => {
      const { getUnit11StepAIContext } = require('./unit-1-1-ai-contexts');
      return getUnit11StepAIContext(stepId);
    },
    getQuickQuestions: (stepId: string) => {
      const { getUnit11StepQuickQuestions } = require('./unit-1-1-ai-contexts');
      return getUnit11StepQuickQuestions(stepId);
    },
    courseMeta: {
      courseId: 'unit-1-1-laplace-transfer-function-v1',
      courseTitle: '1-1：拉氏变换与传递函数——从微分方程到代数方程',
      courseDescription:
        '围绕降维逻辑、微分定理、传递函数三步法、零极点判读和典型环节识别，建立层1的第一节数学精化课。',
    },
  },

  'unit-1-3-time-domain-response-v1': {
    getStepContext: (stepId: string) => getUnit13StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit13StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-1-3-time-domain-response-v1',
      courseTitle: '1-3：时域响应分析——从响应曲线到动态性能指标',
      courseDescription:
        '围绕单位阶跃响应、一阶与二阶系统标准型及四个关键时域指标，建立从响应曲线到动态品质判断的第一套语言。',
    },
  },

  'unit-1-2-block-diagram-simplification-v1': {
    getStepContext: (stepId: string) => {
      const { getUnit12StepAIContext } = require('./unit-1-2-ai-contexts');
      return getUnit12StepAIContext(stepId);
    },
    getQuickQuestions: (stepId: string) => {
      const { getUnit12StepQuickQuestions } = require('./unit-1-2-ai-contexts');
      return getUnit12StepQuickQuestions(stepId);
    },
    courseMeta: {
      courseId: 'unit-1-2-block-diagram-simplification-v1',
      courseTitle: '1-2：系统结构图与化简——从积木块到系统蓝图',
      courseDescription:
        '围绕结构图四元素、三种基本连接、等效变换、代数化简与梅森公式，建立从局部积木到系统蓝图的组装视角。',
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
