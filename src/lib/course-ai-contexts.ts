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
import { resolveInteractiveLessonIdentity } from './interactive-lesson-identity';
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
import {
  getUnit24StepAIContext as getUnit24StepAIContextLocal,
  getUnit24StepQuickQuestions as getUnit24StepQuickQuestionsLocal,
} from './unit-2-4-ai-contexts';
import {
  getUnit31StepAIContext as getUnit31StepAIContextLocal,
  getUnit31StepQuickQuestions as getUnit31StepQuickQuestionsLocal,
} from './unit-3-1-ai-contexts';
import {
  getUnit32StepAIContext as getUnit32StepAIContextLocal,
  getUnit32StepQuickQuestions as getUnit32StepQuickQuestionsLocal,
} from './unit-3-2-ai-contexts';
import {
  getUnit33StepAIContext as getUnit33StepAIContextLocal,
  getUnit33StepQuickQuestions as getUnit33StepQuickQuestionsLocal,
} from './unit-3-3-ai-contexts';
import {
  getUnit34StepAIContext as getUnit34StepAIContextLocal,
  getUnit34StepQuickQuestions as getUnit34StepQuickQuestionsLocal,
} from './unit-3-4-ai-contexts';
import {
  getUnit35StepAIContext as getUnit35StepAIContextLocal,
  getUnit35StepQuickQuestions as getUnit35StepQuickQuestionsLocal,
} from './unit-3-5-ai-contexts';
import {
  getUnit36StepAIContext as getUnit36StepAIContextLocal,
  getUnit36StepQuickQuestions as getUnit36StepQuickQuestionsLocal,
} from './unit-3-6-ai-contexts';
import {
  getUnit37StepAIContext as getUnit37StepAIContextLocal,
  getUnit37StepQuickQuestions as getUnit37StepQuickQuestionsLocal,
} from './unit-3-7-ai-contexts';
import {
  getUnit38StepAIContext as getUnit38StepAIContextLocal,
  getUnit38StepQuickQuestions as getUnit38StepQuickQuestionsLocal,
} from './unit-3-8-ai-contexts';
import {
  getUnit39StepAIContext as getUnit39StepAIContextLocal,
  getUnit39StepQuickQuestions as getUnit39StepQuickQuestionsLocal,
} from './unit-3-9-ai-contexts';
import {
  getUnit41StepAIContext as getUnit41StepAIContextLocal,
  getUnit41StepQuickQuestions as getUnit41StepQuickQuestionsLocal,
} from './unit-4-1-ai-contexts';
import {
  getUnit42StepAIContext as getUnit42StepAIContextLocal,
  getUnit42StepQuickQuestions as getUnit42StepQuickQuestionsLocal,
} from './unit-4-2-ai-contexts';
import {
  getUnit43StepAIContext as getUnit43StepAIContextLocal,
  getUnit43StepQuickQuestions as getUnit43StepQuickQuestionsLocal,
} from './unit-4-3-ai-contexts';
import {
  getUnit44StepAIContext,
  getUnit44StepAIContextLocal,
  getUnit44StepQuickQuestions,
  getUnit44StepQuickQuestionsLocal,
  UNIT_4_4_COURSE_META,
} from './unit-4-4-ai-contexts';
import {
  getUnit45StepAIContextLocal,
  getUnit45StepQuickQuestionsLocal,
  UNIT_4_5_COURSE_META,
} from './unit-4-5-ai-contexts';
import {
  getUnit46StepAIContextLocal,
  getUnit46StepQuickQuestionsLocal,
  UNIT_4_6_COURSE_META,
} from './unit-4-6-ai-contexts';
import {
  getUnit47StepAIContextLocal,
  getUnit47StepQuickQuestionsLocal,
  UNIT_4_7_COURSE_META,
} from './unit-4-7-ai-contexts';
import {
  getUnit51StepAIContextLocal,
  getUnit51StepQuickQuestionsLocal,
  UNIT_5_1_COURSE_META,
} from './unit-5-1-ai-contexts';
import {
  getUnit52StepAIContextLocal,
  getUnit52StepQuickQuestionsLocal,
  UNIT_5_2_COURSE_META,
} from './unit-5-2-ai-contexts';
import {
  getUnit53StepAIContextLocal,
  getUnit53StepQuickQuestionsLocal,
  UNIT_5_3_COURSE_META,
} from './unit-5-3-ai-contexts';
import {
  getUnit54StepAIContextLocal,
  getUnit54StepQuickQuestionsLocal,
  UNIT_5_4_COURSE_META,
} from './unit-5-4-ai-contexts';
import {
  getUnit55StepAIContextLocal,
  getUnit55StepQuickQuestionsLocal,
  UNIT_5_5_COURSE_META,
} from './unit-5-5-ai-contexts';
import {
  getUnit56StepAIContextLocal,
  getUnit56StepQuickQuestionsLocal,
  UNIT_5_6_COURSE_META,
} from './unit-5-6-ai-contexts';

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

// 2-4 课程 AI 上下文
export {
  UNIT_2_4_COURSE_META,
  UNIT_2_4_STEP_AI_CONTEXTS,
  getUNIT_2_4StepAIContext,
  getUNIT_2_4StepQuickQuestions,
  getUnit24StepAIContext,
  getUnit24StepQuickQuestions,
} from './unit-2-4-ai-contexts';

// 3-1 课程 AI 上下文
export {
  UNIT_3_1_COURSE_META,
  UNIT_3_1_STEP_AI_CONTEXTS,
  getUNIT_3_1StepAIContext,
  getUNIT_3_1StepQuickQuestions,
  getUnit31StepAIContext,
  getUnit31StepQuickQuestions,
} from './unit-3-1-ai-contexts';

// 3-2 课程 AI 上下文
export {
  UNIT_3_2_COURSE_META,
  UNIT_3_2_STEP_AI_CONTEXTS,
  getUNIT_3_2StepAIContext,
  getUNIT_3_2StepQuickQuestions,
  getUnit32StepAIContext,
  getUnit32StepQuickQuestions,
} from './unit-3-2-ai-contexts';

// 3-3 课程 AI 上下文
export {
  UNIT_3_3_COURSE_META,
  UNIT_3_3_STEP_AI_CONTEXTS,
  getUNIT_3_3StepAIContext,
  getUNIT_3_3StepQuickQuestions,
  getUnit33StepAIContext,
  getUnit33StepQuickQuestions,
} from './unit-3-3-ai-contexts';

// 3-4 课程 AI 上下文
export {
  UNIT_3_4_COURSE_META,
  UNIT_3_4_STEP_AI_CONTEXTS,
  getUNIT_3_4StepAIContext,
  getUNIT_3_4StepQuickQuestions,
  getUnit34StepAIContext,
  getUnit34StepQuickQuestions,
} from './unit-3-4-ai-contexts';

// 3-5 课程 AI 上下文
export {
  UNIT_3_5_COURSE_META,
  UNIT_3_5_STEP_AI_CONTEXTS,
  getUnit35StepAIContext,
  getUnit35StepQuickQuestions,
} from './unit-3-5-ai-contexts';

// 3-6 课程 AI 上下文
export {
  UNIT_3_6_COURSE_META,
  UNIT_3_6_STEP_AI_CONTEXTS,
  getUnit36StepAIContext,
  getUnit36StepQuickQuestions,
} from './unit-3-6-ai-contexts';

export {
  UNIT_3_7_COURSE_META,
  UNIT_3_7_STEP_AI_CONTEXTS,
  getUNIT_3_7StepAIContext,
  getUNIT_3_7StepQuickQuestions,
  getUnit37StepAIContext,
  getUnit37StepQuickQuestions,
} from './unit-3-7-ai-contexts';

export {
  UNIT_3_8_COURSE_META,
  UNIT_3_8_STEP_AI_CONTEXTS,
  getUNIT_3_8StepAIContext,
  getUNIT_3_8StepQuickQuestions,
  getUnit38StepAIContext,
  getUnit38StepQuickQuestions,
} from './unit-3-8-ai-contexts';

export {
  UNIT_3_9_COURSE_META,
  UNIT_3_9_STEP_AI_CONTEXTS,
  getUNIT_3_9StepAIContext,
  getUNIT_3_9StepQuickQuestions,
  getUnit39StepAIContext,
  getUnit39StepQuickQuestions,
} from './unit-3-9-ai-contexts';

export {
  UNIT_4_1_COURSE_META,
  UNIT_4_1_STEP_AI_CONTEXTS,
  getUNIT_4_1StepAIContext,
  getUNIT_4_1StepQuickQuestions,
  getUnit41StepAIContext,
  getUnit41StepQuickQuestions,
} from './unit-4-1-ai-contexts';

export {
  UNIT_4_2_COURSE_META,
  UNIT_4_2_STEP_AI_CONTEXTS,
  getUNIT_4_2StepAIContext,
  getUNIT_4_2StepQuickQuestions,
  getUnit42StepAIContext,
  getUnit42StepQuickQuestions,
} from './unit-4-2-ai-contexts';
export {
  UNIT_4_3_COURSE_META,
  UNIT_4_3_STEP_AI_CONTEXTS,
  getUNIT_4_3StepAIContext,
  getUNIT_4_3StepQuickQuestions,
  getUnit43StepAIContext,
  getUnit43StepQuickQuestions,
} from './unit-4-3-ai-contexts';
export {
  UNIT_4_4_COURSE_META,
  UNIT_4_4_STEP_AI_CONTEXTS,
  getUnit44StepAIContext,
  getUnit44StepQuickQuestions,
  getUnit44StepAIContextLocal,
  getUnit44StepQuickQuestionsLocal,
} from './unit-4-4-ai-contexts';
export {
  UNIT_4_5_COURSE_META,
  UNIT_4_5_STEP_AI_CONTEXTS,
  getUnit45StepAIContext,
  getUnit45StepQuickQuestions,
  getUnit45StepAIContextLocal,
  getUnit45StepQuickQuestionsLocal,
} from './unit-4-5-ai-contexts';
export {
  UNIT_4_6_COURSE_META,
  UNIT_4_6_STEP_AI_CONTEXTS,
  getUnit46StepAIContext,
  getUnit46StepQuickQuestions,
  getUnit46StepAIContextLocal,
  getUnit46StepQuickQuestionsLocal,
} from './unit-4-6-ai-contexts';
export {
  UNIT_4_7_COURSE_META,
  UNIT_4_7_STEP_AI_CONTEXTS,
  getUnit47StepAIContext,
  getUnit47StepQuickQuestions,
  getUnit47StepAIContextLocal,
  getUnit47StepQuickQuestionsLocal,
} from './unit-4-7-ai-contexts';
export {
  UNIT_5_1_COURSE_META,
  UNIT_5_1_STEP_AI_CONTEXTS,
  getUnit51StepAIContext,
  getUnit51StepQuickQuestions,
  getUnit51StepAIContextLocal,
  getUnit51StepQuickQuestionsLocal,
} from './unit-5-1-ai-contexts';
export {
  UNIT_5_2_COURSE_META,
  UNIT_5_2_STEP_AI_CONTEXTS,
  getUnit52StepAIContext,
  getUnit52StepQuickQuestions,
  getUnit52StepAIContextLocal,
  getUnit52StepQuickQuestionsLocal,
} from './unit-5-2-ai-contexts';
export {
  UNIT_5_3_COURSE_META,
  UNIT_5_3_STEP_AI_CONTEXTS,
  getUnit53StepAIContext,
  getUnit53StepQuickQuestions,
  getUnit53StepAIContextLocal,
  getUnit53StepQuickQuestionsLocal,
} from './unit-5-3-ai-contexts';
export {
  UNIT_5_4_COURSE_META,
  UNIT_5_4_STEP_AI_CONTEXTS,
  getUnit54StepAIContext,
  getUnit54StepQuickQuestions,
  getUnit54StepAIContextLocal,
  getUnit54StepQuickQuestionsLocal,
} from './unit-5-4-ai-contexts';
export {
  UNIT_5_5_COURSE_META,
  UNIT_5_5_STEP_AI_CONTEXTS,
  getUnit55StepAIContext,
  getUnit55StepQuickQuestions,
  getUnit55StepAIContextLocal,
  getUnit55StepQuickQuestionsLocal,
} from './unit-5-5-ai-contexts';
export {
  UNIT_5_6_COURSE_META,
  UNIT_5_6_STEP_AI_CONTEXTS,
  getUnit56StepAIContext,
  getUnit56StepQuickQuestions,
  getUnit56StepAIContextLocal,
  getUnit56StepQuickQuestionsLocal,
} from './unit-5-6-ai-contexts';

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

  'unit-2-4-nyquist-margin-entry-v1': {
    getStepContext: (stepId: string) => getUnit24StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit24StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-2-4-nyquist-margin-entry-v1',
      courseTitle: '2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
      courseDescription:
        '围绕同一个 G(jω) 的双图表达、纯极点系统 Nyquist 读图、频域指标入口、手工绘图入口与最小反向识别，完成模块 2 的图形对象收束。',
    },
  },

  'unit-3-1-pure-pole-stability-and-dynamics-v1': {
    getStepContext: (stepId: string) => getUnit31StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit31StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-1-pure-pole-stability-and-dynamics-v1',
      courseTitle: '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
      courseDescription:
        '围绕稳定底线、极点到模态、主导极点近似、Bode 证据与卷积收束，建立模块 3 的第一堂结构机理精品互动课。',
    },
  },

  'unit-3-2-routh-stability-boundary-v1': {
    getStepContext: (stepId: string) => getUnit32StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit32StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-2-routh-stability-boundary-v1',
      courseTitle: '3-2：劳斯判据——从高阶系统稳定判定到参数可行域',
      courseDescription:
        '围绕普通劳斯判稳、参数区间、两类特殊情况、三域翻译与变量平移，把高阶系统的稳定底线推进到参数可行域语言。',
    },
  },

  'unit-3-3-root-locus-rules-v1': {
    getStepContext: (stepId: string) => getUnit33StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit33StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-3-root-locus-rules-v1',
      courseTitle: '3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
      courseDescription:
        '围绕 GH=-1、相角/幅值条件、完整法则、广义根轨迹与动态翻译，建立模块 3 的极点迁移机制主线。',
    },
  },

  'unit-3-4-root-locus-reading-validation-v1': {
    getStepContext: (stepId: string) => getUnit34StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit34StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-4-root-locus-reading-validation-v1',
      courseTitle: '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
      courseDescription:
        '围绕关键节点读图、参数窗口判断、根轨迹增益换算与对象化三域验证，把根轨迹法则压成可执行的工程判断动作。',
    },
  },

  'unit-3-5-zero-dynamic-improvement-v1': {
    getStepContext: (stepId: string) => getUnit35StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit35StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-5-zero-dynamic-improvement-v1',
      courseTitle: '3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
      courseDescription:
        '围绕零点重排、PD/测速反馈、超前频域整形与非最小相边界，把“结构改变为什么会改写三域表现”讲成一条可执行判断链。',
    },
  },

  'unit-3-6-zero-design-workshop-v1': {
    getStepContext: (stepId: string) => getUnit36StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit36StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-6-zero-design-workshop-v1',
      courseTitle: '3-6：零点作用与动态改善实验——从性能目标到校正设计',
      courseDescription:
        '围绕目标分类、时域 / 频域指标翻译、PD / 测速反馈 / 超前设计与非最小相边界选择，把“会判断”推进到“会按目标进入设计链”。',
    },
  },

  'unit-3-7-steady-error-low-frequency-compensation-v1': {
    getStepContext: (stepId: string) => getUnit37StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit37StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-7-steady-error-low-frequency-compensation-v1',
      courseTitle: '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
      courseDescription:
        '围绕给定/扰动双通道、终值定理与型别快判、PI/滞后低频补偿比较，把“为什么更准”推进成可执行的误差分析与补偿路径。',
    },
  },

  'unit-3-8-frequency-domain-translation-judgment-v1': {
    getStepContext: (stepId: string) => getUnit38StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit38StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-8-frequency-domain-translation-judgment-v1',
      courseTitle: '3-8：频域判别与跨域综合语言',
      courseDescription:
        '围绕结构变化的频域指纹、Nyquist/Bode 统一判稳链、三频段分工与工程案例读回，把模块 3 理论主线收束为一张频域判断地图。',
    },
  },

  'unit-3-9-cross-domain-mapping-lab-v1': {
    getStepContext: (stepId: string) => getUnit39StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit39StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-3-9-cross-domain-mapping-lab-v1',
      courseTitle: '3-9：稳定—动态—稳态综合映射实验',
      courseDescription:
        '围绕同一航向控制对象，把基准、零点线补强、积分家族与滞后对照收束为一张稳定—动态—稳态综合映射表，并把模块 3 的出口判断接到 4-1。',
    },
  },

  'unit-4-1-design-task-expression-v1': {
    getStepContext: (stepId: string) => getUnit41StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit41StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-4-1-design-task-expression-v1',
      courseTitle: '4-1：设计起点：性能指标体系、工程约束与可行域表达',
      courseDescription:
        '围绕指标角色重组、硬约束/软目标/观察指标分类、可行域分层和双案例联读，把已有分析证据收束成任务表达卡。',
    },
  },

  'unit-4-2-controller-selection-first-start-v1': {
    getStepContext: (stepId: string) => getUnit42StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit42StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-4-2-controller-selection-first-start-v1',
      courseTitle: '4-2：控制器选型原理：不同控制结构为何适合不同任务',
      courseDescription:
        '围绕结构工具箱、三频段职责、双案例首轮起步与前馈补偿边界，把任务表达卡推进成单结构首轮起步卡。',
    },
  },

  'unit-4-3-initial-scheme-practice-first-validation-v1': {
    getStepContext: (stepId: string) => getUnit43StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit43StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: 'unit-4-3-initial-scheme-practice-first-validation-v1',
      courseTitle: '4-3：经典复合控制的初始方案落地：从单结构候选到工程可运行方案',
      courseDescription:
        '围绕单结构候选缺口、经典复合控制边界、前馈与反馈分工、实现层保护和客船首轮记录，把已有反馈主结构推进为工程可运行的初始方案。',
    },
  },

  'unit-4-4-fixed-structure-optimization-modeling-v1': {
    getStepContext: (stepId: string) => getUnit44StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit44StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_4_4_COURSE_META.courseId,
      courseTitle: UNIT_4_4_COURSE_META.courseTitle,
      courseDescription: UNIT_4_4_COURSE_META.courseDescription,
    },
  },

  'unit-4-5-constraint-aware-parameter-optimization-v1': {
    getStepContext: (stepId: string) => getUnit45StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit45StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_4_5_COURSE_META.courseId,
      courseTitle: UNIT_4_5_COURSE_META.courseTitle,
      courseDescription: UNIT_4_5_COURSE_META.courseDescription,
    },
  },

  'unit-4-6-fixed-structure-boundary-structural-encoding-v1': {
    getStepContext: (stepId: string) => getUnit46StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit46StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_4_6_COURSE_META.courseId,
      courseTitle: UNIT_4_6_COURSE_META.courseTitle,
      courseDescription: UNIT_4_6_COURSE_META.courseDescription,
    },
  },

  'unit-4-7-destroyer-hifi-design-closure-v1': {
    getStepContext: (stepId: string) => getUnit47StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit47StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_4_7_COURSE_META.courseId,
      courseTitle: UNIT_4_7_COURSE_META.courseTitle,
      courseDescription: UNIT_4_7_COURSE_META.courseDescription,
    },
  },

  'unit-5-1-linear-backbone-boundaries-v1': {
    getStepContext: (stepId: string) => getUnit51StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit51StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_1_COURSE_META.courseId,
      courseTitle: UNIT_5_1_COURSE_META.courseTitle,
      courseDescription: UNIT_5_1_COURSE_META.courseDescription,
    },
  },

  'unit-5-2-nonlinear-analysis-entry-v1': {
    getStepContext: (stepId: string) => getUnit52StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit52StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_2_COURSE_META.courseId,
      courseTitle: UNIT_5_2_COURSE_META.courseTitle,
      courseDescription: UNIT_5_2_COURSE_META.courseDescription,
    },
  },

  'unit-5-3-mass-coordination-chain-v1': {
    getStepContext: (stepId: string) => getUnit53StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit53StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_3_COURSE_META.courseId,
      courseTitle: UNIT_5_3_COURSE_META.courseTitle,
      courseDescription: UNIT_5_3_COURSE_META.courseDescription,
    },
  },

  'unit-5-4-data-driven-mpc-transition-v1': {
    getStepContext: (stepId: string) => getUnit54StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit54StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_4_COURSE_META.courseId,
      courseTitle: UNIT_5_4_COURSE_META.courseTitle,
      courseDescription: UNIT_5_4_COURSE_META.courseDescription,
    },
  },

  'unit-5-5-policy-learning-entry-risk-v1': {
    getStepContext: (stepId: string) => getUnit55StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit55StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_5_COURSE_META.courseId,
      courseTitle: UNIT_5_5_COURSE_META.courseTitle,
      courseDescription: UNIT_5_5_COURSE_META.courseDescription,
    },
  },

  'unit-5-6-method-comparison-cold-chain-v1': {
    getStepContext: (stepId: string) => getUnit56StepAIContextLocal(stepId),
    getQuickQuestions: (stepId: string) => getUnit56StepQuickQuestionsLocal(stepId),
    courseMeta: {
      courseId: UNIT_5_6_COURSE_META.courseId,
      courseTitle: UNIT_5_6_COURSE_META.courseTitle,
      courseDescription: UNIT_5_6_COURSE_META.courseDescription,
    },
  },
};

function resolveAIContextRegistryKey(courseId: string): string | null {
  if (courseId in COURSE_AI_CONTEXT_REGISTRY) return courseId;
  const resolved = resolveInteractiveLessonIdentity(courseId);
  if (resolved.status !== 'resolved') return null;
  return resolved.record.lessonKeys.find((lessonKey) => lessonKey in COURSE_AI_CONTEXT_REGISTRY) ?? null;
}

/**
 * 根据课程ID和步骤ID获取AI上下文配置
 */
export function getStepAIContext(
  courseId: string,
  stepId: string
): AIContextConfig | null {
  const registryKey = resolveAIContextRegistryKey(courseId);
  const courseRegistry = registryKey ? COURSE_AI_CONTEXT_REGISTRY[registryKey] : null;
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
  const registryKey = resolveAIContextRegistryKey(courseId);
  const courseRegistry = registryKey ? COURSE_AI_CONTEXT_REGISTRY[registryKey] : null;
  if (!courseRegistry) return [];
  return courseRegistry.getQuickQuestions(stepId);
}

/**
 * 检查课程是否已注册AI上下文
 */
export function isCourseAIContextRegistered(courseId: string): boolean {
  return resolveAIContextRegistryKey(courseId) !== null;
}

/**
 * 获取所有已注册的课程ID列表
 */
export function getRegisteredCourseIds(): string[] {
  return Object.keys(COURSE_AI_CONTEXT_REGISTRY);
}
