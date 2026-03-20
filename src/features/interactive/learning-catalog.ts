import type { InteractiveCategory } from '@prisma/client';
import type { ElementType } from 'react';
import {
  Activity,
  Boxes,
  GitBranch,
  Radio,
  Shuffle,
  Sliders,
  Sparkles,
} from 'lucide-react';

import { L2A_PREMIUM_LESSON_CARD } from '@/lib/l2a-course';
import { L2B_PREMIUM_LESSON_CARD } from '@/lib/l2b-course';
import { L2C_PREMIUM_LESSON_CARD } from '@/lib/l2c-course';
import { L2D_PREMIUM_LESSON_CARD } from '@/lib/l2d-course';
import { LSUM_PREMIUM_LESSON_CARD } from '@/lib/lsum-course';
import { UNIT_1_1_PREMIUM_LESSON_CARD } from '@/lib/unit-1-1-course';
import { UNIT_1_2_PREMIUM_LESSON_CARD } from '@/lib/unit-1-2-course';

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

export type CategoryConfig = {
  label: string;
  icon: ElementType;
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
  L2A_PREMIUM_LESSON_CARD,
  L2B_PREMIUM_LESSON_CARD,
  L2C_PREMIUM_LESSON_CARD,
  L2D_PREMIUM_LESSON_CARD,
  LSUM_PREMIUM_LESSON_CARD,
  UNIT_1_1_PREMIUM_LESSON_CARD,
  UNIT_1_2_PREMIUM_LESSON_CARD,
  {
    id: 'cruise-comfort-boppps',
    title: '柔性之海：豪华邮轮舒适度控制课堂实录',
    description: '45 分钟精品课程：基于 BOPPPS 的教师端/学生端联动课堂实录流程。',
    duration: '45 分钟',
    href: '/interactive-learning/courses/cruise-comfort-boppps',
    badge: '精品课程',
  },
  {
    id: 'lesson-01',
    title: '反馈：控制原理的核心思想',
    description: '90 分钟互动课程：反馈、闭环与控制系统结构。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-01',
    badge: 'Lesson 01',
  },
  {
    id: 'lesson-02',
    title: '拉氏变换：工程直觉的数学实现',
    description: '90 分钟互动课程：s 域直觉、常用定理与反变换路径。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-02',
    badge: 'Lesson 02',
  },
  {
    id: 'lesson-03',
    title: '微分方程与控制系统基础模型',
    description: '90 分钟互动课程：微分方程建模方法与典型案例。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-03',
    badge: 'Lesson 03',
  },
  {
    id: 'lesson-04',
    title: '传递函数与控制系统数学模型',
    description: '90 分钟互动课程：传递函数定义、推导与零极点判读。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-04',
    badge: 'Lesson 04',
  },
  {
    id: 'lesson-05',
    title: '方框图、信号流图与梅森公式',
    description: '90 分钟互动课程：结构图化简、信号流图建模与梅森公式。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-05',
    badge: 'Lesson 05',
  },
  {
    id: 'lesson-06',
    title: '指标裁判席：时域性能的量尺',
    description: '90 分钟互动课程：时域指标速判、裁判手册与计分实训。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-06',
    badge: 'Lesson 06',
  },
  {
    id: 'lesson-07',
    title: '衰减振荡：欠阻尼二阶系统',
    description: '90 分钟互动课程：二阶系统标准型、极点位置与响应指标。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-07',
    badge: 'Lesson 07',
  },
  {
    id: 'lesson-08',
    title: '稳定性与稳态误差',
    description: '90 分钟互动课程：劳斯判据、终值定理与静态误差系数。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-08',
    badge: 'Lesson 08',
  },
  {
    id: 'lesson-09',
    title: '校正与时域综合：验证路径',
    description: '90 分钟互动课程：校正手段、补偿策略与时域综合验证。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-09',
    badge: 'Lesson 09',
  },
  {
    id: 'lesson-10',
    title: '根轨迹法：从全局到细节',
    description: '90 分钟互动课程：模值/相角条件、分离点与渐近线判读。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-10',
    badge: 'Lesson 10',
  },
  {
    id: 'lesson-11',
    title: '参数根轨迹与图形化思考',
    description: '90 分钟互动课程：广义定义、稳定范围与主导极点选择。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-11',
    badge: 'Lesson 11',
  },
  {
    id: 'lesson-12',
    title: '频率特性与伯德图',
    description: '90 分钟互动课程：对数频率特性、斜率叠加与读图反推。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-12',
    badge: 'Lesson 12',
  },
  {
    id: 'lesson-13',
    title: '幅相特性与稳定判据：频域的启示',
    description: '90 分钟互动课程：Nyquist 图、对数判据与频域判稳链路。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-13',
    badge: 'Lesson 13',
  },
  {
    id: 'lesson-14',
    title: '稳定裕度与三频段：宽备窄用',
    description: '90 分钟互动课程：稳定裕度评估与三频段性能分工。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-14',
    badge: 'Lesson 14',
  },
  {
    id: 'lesson-15',
    title: '串联校正与滞后超前：双管齐下',
    description: '90 分钟互动课程：超前/滞后校正与联合设计流程。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-15',
    badge: 'Lesson 15',
  },
  {
    id: 'lesson-16',
    title: '非线性系统与描述函数基础',
    description: '90 分钟互动课程：非线性现象、谐波线性化与描述函数基础。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-16',
    badge: 'Lesson 16',
  },
  {
    id: 'lesson-17',
    title: '描述函数分析法与自振判别',
    description: '90 分钟互动课程：负倒描述函数与交点判别流程。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-17',
    badge: 'Lesson 17',
  },
] as const;

export const PREMIUM_LESSONS = FEATURED_LESSONS.filter((lesson) =>
  lesson.id === 'cruise-comfort-boppps' ||
  lesson.id === 'l2a-time-domain-fasttrack' ||
  lesson.id === 'l2b-root-locus-fasttrack' ||
  lesson.id === 'l2c-frequency-bode-fasttrack' ||
  lesson.id === 'l2d-three-domain-linkage-practice' ||
  lesson.id === 'lsum-design-feasible-domain' ||
  lesson.id === 'unit-1-1-laplace-transfer-function'
);

export const LEGACY_LESSONS = FEATURED_LESSONS.filter(
  (lesson) =>
    lesson.id !== 'cruise-comfort-boppps' &&
    lesson.id !== 'l2a-time-domain-fasttrack' &&
    lesson.id !== 'l2b-root-locus-fasttrack' &&
    lesson.id !== 'l2c-frequency-bode-fasttrack' &&
    lesson.id !== 'l2d-three-domain-linkage-practice' &&
    lesson.id !== 'lsum-design-feasible-domain' &&
    lesson.id !== 'unit-1-1-laplace-transfer-function'
);

export const CHAPTER_LESSONS = LEGACY_LESSONS;

export function findCategoryKeyBySlug(slug: string): string | null {
  for (const [categoryKey, config] of Object.entries(CATEGORY_CONFIG)) {
    if (config.routeSlug === slug) {
      return categoryKey;
    }
  }
  return null;
}
