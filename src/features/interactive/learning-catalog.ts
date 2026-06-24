import type { InteractiveCategory } from '@prisma/client';
import {
  Activity,
  Boxes,
  GitBranch,
  Radio,
  Shuffle,
  Sliders,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { UNIT_1_1_PREMIUM_LESSON_CARD } from '@/lib/unit-1-1-course';
import { UNIT_1_2_PREMIUM_LESSON_CARD } from '@/lib/unit-1-2-course';
import { UNIT_2_1_PREMIUM_LESSON_CARD } from '@/lib/unit-2-1-course';
import { UNIT_2_2_PREMIUM_LESSON_CARD } from '@/lib/unit-2-2-course';
import { UNIT_2_3_PREMIUM_LESSON_CARD } from '@/lib/unit-2-3-course';
import { UNIT_2_4_PREMIUM_LESSON_CARD } from '@/lib/unit-2-4-course';
import { UNIT_3_1_PREMIUM_LESSON_CARD } from '@/lib/unit-3-1-course';
import { UNIT_3_2_PREMIUM_LESSON_CARD } from '@/lib/unit-3-2-course';
import { UNIT_3_3_PREMIUM_LESSON_CARD } from '@/lib/unit-3-3-course';
import { UNIT_3_4_PREMIUM_LESSON_CARD } from '@/lib/unit-3-4-course';
import { UNIT_3_5_PREMIUM_LESSON_CARD } from '@/lib/unit-3-5-course';
import { UNIT_3_6_PREMIUM_LESSON_CARD } from '@/lib/unit-3-6-course';
import { UNIT_3_7_PREMIUM_LESSON_CARD } from '@/lib/unit-3-7-course';
import { UNIT_3_8_PREMIUM_LESSON_CARD } from '@/lib/unit-3-8-course';
import { UNIT_3_9_PREMIUM_LESSON_CARD } from '@/lib/unit-3-9-course';
import { UNIT_4_1_PREMIUM_LESSON_CARD } from '@/lib/unit-4-1-course';
import { UNIT_4_2_PREMIUM_LESSON_CARD } from '@/lib/unit-4-2-course';
import { UNIT_4_3_PREMIUM_LESSON_CARD } from '@/lib/unit-4-3-course';
import { UNIT_4_4_PREMIUM_LESSON_CARD } from '@/lib/unit-4-4-course';
import { UNIT_4_6_PREMIUM_LESSON_CARD } from '@/lib/unit-4-6-course';
import { UNIT_4_7_PREMIUM_LESSON_CARD } from '@/lib/unit-4-7-course';
import { UNIT_5_1_PREMIUM_LESSON_CARD } from '@/lib/unit-5-1-course';
import { UNIT_5_2_PREMIUM_LESSON_CARD } from '@/lib/unit-5-2-course';
import { UNIT_5_3_PREMIUM_LESSON_CARD } from '@/lib/unit-5-3-course';
import { UNIT_5_4_PREMIUM_LESSON_CARD } from '@/lib/unit-5-4-course';
import { UNIT_5_5_PREMIUM_LESSON_CARD } from '@/lib/unit-5-5-course';
import { UNIT_5_6_PREMIUM_LESSON_CARD } from '@/lib/unit-5-6-course';

const UNIT_4_5_PREMIUM_LESSON_CARD = {
  id: 'unit-4-5-constraint-aware-parameter-optimization',
  title: '4-5：约束下的优化设计实践：参数约束翻译与带约束参数优化',
  description:
    '精品互动课：把越界证据、硬约束翻译、罚函数与带约束三方案比较连成一条可交付判断链。',
  duration: '90 分钟',
  href: '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization',
  badge: '精品课程',
} as const;

export interface InteractiveResource {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  registryId: string | null;
  type: string;
  category: InteractiveCategory | null;
  displayOrder: number;
}

export type InteractiveCourseKind = '理论课' | '实践课';

export interface InteractiveCourseHubLesson {
  id: string;
  title: string;
  description: string;
  href: string;
  courseKind: InteractiveCourseKind;
  runtimeCardMetadata: {
    durationLabel: string;
    statusLabel: string;
  };
  unitLabel: string;
  legacySourceLabel?: string;
}

export interface InteractiveCourseHubModule {
  id: string;
  title: string;
  description: string;
  chipLabel: string;
  lessons: InteractiveCourseHubLesson[];
}

export type CategoryConfig = {
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  routeSlug: string;
};

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  SYSTEM_MODELING: {
    label: '系统建模',
    icon: Boxes,
    color: 'blue',
    description: '学习如何建立物理系统的数学模型',
    routeSlug: 'system-modeling',
  },
  TIME_DOMAIN: {
    label: '时域分析',
    icon: Activity,
    color: 'emerald',
    description: '分析系统的时间响应特性',
    routeSlug: 'time-domain',
  },
  ROOT_LOCUS: {
    label: '根轨迹分析',
    icon: GitBranch,
    color: 'violet',
    description: '探索闭环极点与系统稳定性的关系',
    routeSlug: 'root-locus',
  },
  FREQUENCY_DOMAIN: {
    label: '频域分析',
    icon: Radio,
    color: 'cyan',
    description: '通过频率响应分析系统特性',
    routeSlug: 'frequency-domain',
  },
  SYSTEM_CORRECTION: {
    label: '系统校正',
    icon: Sliders,
    color: 'amber',
    description: '设计控制器改善系统性能',
    routeSlug: 'system-correction',
  },
  NONLINEAR: {
    label: '非线性',
    icon: Shuffle,
    color: 'rose',
    description: '处理非线性系统和伦理决策',
    routeSlug: 'nonlinear',
  },
  FUN_EXPLORATION: {
    label: '跨域探索',
    icon: Sparkles,
    color: 'fuchsia',
    description: '以跨域问题驱动控制思维、模型与图形推理',
    routeSlug: 'cross-domain',
  },
};

export const CATEGORY_ORDER = [
  'SYSTEM_MODELING',
  'TIME_DOMAIN',
  'ROOT_LOCUS',
  'FREQUENCY_DOMAIN',
  'SYSTEM_CORRECTION',
  'NONLINEAR',
  'FUN_EXPLORATION',
] as const;

export const CHAPTER_COMPONENT_CATEGORIES = CATEGORY_ORDER.filter(
  (category) => category !== 'FUN_EXPLORATION'
);

export const FEATURED_LESSONS = [
  UNIT_1_1_PREMIUM_LESSON_CARD,
  UNIT_1_2_PREMIUM_LESSON_CARD,
  UNIT_2_1_PREMIUM_LESSON_CARD,
  UNIT_2_2_PREMIUM_LESSON_CARD,
  UNIT_2_3_PREMIUM_LESSON_CARD,
  UNIT_2_4_PREMIUM_LESSON_CARD,
  UNIT_3_1_PREMIUM_LESSON_CARD,
  UNIT_3_2_PREMIUM_LESSON_CARD,
  UNIT_3_3_PREMIUM_LESSON_CARD,
  UNIT_3_4_PREMIUM_LESSON_CARD,
  UNIT_3_5_PREMIUM_LESSON_CARD,
  UNIT_3_6_PREMIUM_LESSON_CARD,
  UNIT_3_7_PREMIUM_LESSON_CARD,
  UNIT_3_8_PREMIUM_LESSON_CARD,
  UNIT_3_9_PREMIUM_LESSON_CARD,
  UNIT_4_1_PREMIUM_LESSON_CARD,
  UNIT_4_2_PREMIUM_LESSON_CARD,
  UNIT_4_3_PREMIUM_LESSON_CARD,
  UNIT_4_4_PREMIUM_LESSON_CARD,
  UNIT_4_5_PREMIUM_LESSON_CARD,
  UNIT_4_6_PREMIUM_LESSON_CARD,
  UNIT_4_7_PREMIUM_LESSON_CARD,
  UNIT_5_1_PREMIUM_LESSON_CARD,
  UNIT_5_2_PREMIUM_LESSON_CARD,
  UNIT_5_3_PREMIUM_LESSON_CARD,
  UNIT_5_4_PREMIUM_LESSON_CARD,
  UNIT_5_5_PREMIUM_LESSON_CARD,
  UNIT_5_6_PREMIUM_LESSON_CARD,
  {
    id: 'cruise-comfort-boppps',
    title: '柔性之海：豪华邮轮舒适度控制',
    description: '45 分钟标准互动课：围绕舒适度约束、PID 参数整定、AI 诊断和工程取舍形成可提交的 BOPPPS 学习链。',
    duration: '45 分钟',
    href: '/interactive-learning/courses/cruise-comfort-boppps',
    badge: '精品课程',
  },
] as const;

export const LEGACY_LESSONS = FEATURED_LESSONS.filter(
  (lesson) =>
    lesson.id !== 'cruise-comfort-boppps' &&
    lesson.id !== 'unit-1-1-see-the-full-picture' &&
    lesson.id !== 'unit-1-2-modeling-from-object-to-system' &&
    lesson.id !== 'unit-2-1-modeling-language' &&
    lesson.id !== 'unit-2-2-time-domain-response' &&
    lesson.id !== 'unit-2-3-frequency-response-bode-intro' &&
    lesson.id !== 'unit-2-4-nyquist-margin-entry' &&
    lesson.id !== 'unit-3-1-pure-pole-stability-and-dynamics' &&
    lesson.id !== 'unit-3-2-routh-stability-boundary' &&
    lesson.id !== 'unit-3-3-root-locus-rules' &&
    lesson.id !== 'unit-3-4-root-locus-reading-validation' &&
    lesson.id !== 'unit-3-5-zero-dynamic-improvement' &&
    lesson.id !== 'unit-3-6-zero-design-workshop' &&
    lesson.id !== 'unit-3-7-steady-error-low-frequency-compensation' &&
    lesson.id !== 'unit-3-8-frequency-domain-translation-judgment' &&
    lesson.id !== 'unit-3-9-cross-domain-mapping-lab' &&
    lesson.id !== 'unit-4-1-design-task-expression' &&
    lesson.id !== 'unit-4-2-controller-selection-first-start' &&
    lesson.id !== 'unit-4-3-initial-scheme-practice-first-validation' &&
    lesson.id !== 'unit-4-4-fixed-structure-optimization-modeling' &&
    lesson.id !== 'unit-4-5-constraint-aware-parameter-optimization' &&
    lesson.id !== 'unit-4-6-fixed-structure-boundary-structural-encoding' &&
    lesson.id !== 'unit-4-7-destroyer-hifi-design-closure' &&
    lesson.id !== 'unit-5-1-linear-backbone-boundaries' &&
    lesson.id !== 'unit-5-2-nonlinear-analysis-entry' &&
    lesson.id !== 'unit-5-3-mass-coordination-chain' &&
    lesson.id !== 'unit-5-4-data-driven-mpc-transition' &&
    lesson.id !== 'unit-5-5-policy-learning-entry-risk' &&
    lesson.id !== 'unit-5-6-method-comparison-cold-chain'
);

export const CHAPTER_LESSONS = LEGACY_LESSONS;

function getFeaturedLessonById(id: string) {
  const lesson = FEATURED_LESSONS.find((item) => item.id === id);

  if (!lesson) {
    throw new Error(`Unknown featured lesson: ${id}`);
  }

  return lesson;
}

function getCourseKind(id: string): InteractiveCourseKind {
  return id === 'cruise-comfort-boppps' ? '实践课' : '理论课';
}

function createCourseHubLesson(
  lesson: (typeof FEATURED_LESSONS)[number],
  unitLabel: string,
  legacySourceLabel?: string
): InteractiveCourseHubLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    href: lesson.href,
    courseKind: getCourseKind(lesson.id),
    runtimeCardMetadata: {
      durationLabel: lesson.duration,
      statusLabel: lesson.badge,
    },
    unitLabel,
    ...(legacySourceLabel ? { legacySourceLabel } : {}),
  };
}

function createModuleLesson(id: string, unitLabel: string, legacySourceLabel?: string): InteractiveCourseHubLesson {
  const lesson = getFeaturedLessonById(id);

  return createCourseHubLesson(lesson, unitLabel, legacySourceLabel);
}

export const PREMIUM_LESSONS = FEATURED_LESSONS.filter((lesson) =>
  lesson.id === 'unit-1-1-see-the-full-picture' ||
  lesson.id === 'unit-1-2-modeling-from-object-to-system' ||
  lesson.id === 'cruise-comfort-boppps'
).map((lesson) => createCourseHubLesson(
  lesson,
  lesson.id === 'unit-1-1-see-the-full-picture'
    ? '1-1'
    : lesson.id === 'unit-1-2-modeling-from-object-to-system'
      ? '1-2'
      : '邮轮实践'
));

export const INTERACTIVE_COURSE_MODULES: InteractiveCourseHubModule[] = [
  {
    id: 'module-1',
    title: '模块1',
    description: '模块1当前开放 1-1 全景导览与 1-2 建模入口，先用一条船建立控制全景，再从真实对象走向微分方程、传递函数、结构图、信号流图和极点行为地图。',
    chipLabel: '已开放单元',
    lessons: [
      createModuleLesson('unit-1-1-see-the-full-picture', '1-1'),
      createModuleLesson('unit-1-2-modeling-from-object-to-system', '1-2'),
    ],
  },
  {
    id: 'module-2',
    title: '模块2',
    description: '模块2当前开放 2-1、2-2、2-3、2-4 四个新主线单元，分别承接统一对象语言、时域响应基础、频域对象入口与 Nyquist/频域指标入口。',
    chipLabel: '已开放单元',
    lessons: [
      createModuleLesson('unit-2-1-modeling-language', '2-1'),
      createModuleLesson('unit-2-2-time-domain-response', '2-2'),
      createModuleLesson('unit-2-3-frequency-response-bode-intro', '2-3'),
      createModuleLesson('unit-2-4-nyquist-margin-entry', '2-4'),
    ],
  },
  {
    id: 'module-3',
    title: '模块3',
    description:
      '模块3当前开放 3-1、3-2、3-3、3-4、3-5、3-6、3-7、3-8、3-9 九个新主线单元，先用纯极点语言压实稳定底线，再推进到劳斯边界、根轨迹法则、读图验证、零点机理、目标驱动设计、稳态误差与低频补偿入口，把结构变化与稳态改善统一收成判断地图，最后在 3-9 做模块出口综合映射。',
    chipLabel: '结构机理主线',
    lessons: [
      createModuleLesson('unit-3-1-pure-pole-stability-and-dynamics', '3-1'),
      createModuleLesson('unit-3-2-routh-stability-boundary', '3-2'),
      createModuleLesson('unit-3-3-root-locus-rules', '3-3'),
      createModuleLesson('unit-3-4-root-locus-reading-validation', '3-4'),
      createModuleLesson('unit-3-5-zero-dynamic-improvement', '3-5'),
      createModuleLesson('unit-3-6-zero-design-workshop', '3-6'),
      createModuleLesson('unit-3-7-steady-error-low-frequency-compensation', '3-7'),
      createModuleLesson('unit-3-8-frequency-domain-translation-judgment', '3-8'),
      createModuleLesson('unit-3-9-cross-domain-mapping-lab', '3-9'),
    ],
  },
  {
    id: 'module-4',
    title: '模块4',
    description:
      '模块4 当前开放 4-1、4-2、4-3、4-4、4-5、4-6、4-7 七个新主线单元，先把模块 3 的证据统一改写成任务表达卡，再推进到起步卡、第一版方案、多目标优化建模、约束化参数优化、固定结构边界与结构编码入口，最后在 4-7 完成高保真辨识、设计验证与扰动边界闭环。',
    chipLabel: '设计入口主线',
    lessons: [
      createModuleLesson('unit-4-1-design-task-expression', '4-1'),
      createModuleLesson('unit-4-2-controller-selection-first-start', '4-2'),
      createModuleLesson('unit-4-3-initial-scheme-practice-first-validation', '4-3'),
      createModuleLesson('unit-4-4-fixed-structure-optimization-modeling', '4-4'),
      createModuleLesson('unit-4-5-constraint-aware-parameter-optimization', '4-5'),
      createModuleLesson('unit-4-6-fixed-structure-boundary-structural-encoding', '4-6'),
      createModuleLesson('unit-4-7-destroyer-hifi-design-closure', '4-7'),
    ],
  },
  {
    id: 'module-5',
    title: '模块5',
    description:
      '模块5 当前开放 5-1、5-2、5-3、5-4、5-5、5-6 六个新主线单元，从线性主干边界识别推进到非线性最小分析入口、MASS 复杂链路责任诊断、模型驱动到数据驱动迁移、策略学习入口与风险判断，最后进入同题任务下的方法比较。',
    chipLabel: '非线性与自主系统链路',
    lessons: [
      createModuleLesson('unit-5-1-linear-backbone-boundaries', '5-1'),
      createModuleLesson('unit-5-2-nonlinear-analysis-entry', '5-2'),
      createModuleLesson('unit-5-3-mass-coordination-chain', '5-3'),
      createModuleLesson('unit-5-4-data-driven-mpc-transition', '5-4'),
      createModuleLesson('unit-5-5-policy-learning-entry-risk', '5-5'),
      createModuleLesson('unit-5-6-method-comparison-cold-chain', '5-6'),
    ],
  },
] as const;

export function findCategoryKeyBySlug(slug: string): string | null {
  for (const [categoryKey, config] of Object.entries(CATEGORY_CONFIG)) {
    if (config.routeSlug === slug) {
      return categoryKey;
    }
  }
  return null;
}
