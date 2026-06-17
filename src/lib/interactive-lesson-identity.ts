import { CRUISE_COURSE_TITLE, CRUISE_PRESET_KEY } from '@/lib/cruise-course';
import { UNIT_1_1_COURSE_TITLE, UNIT_1_1_LESSON_KEY, UNIT_1_1_PRESET_KEY, UNIT_1_1_ROUTE_SEGMENT } from '@/lib/unit-1-1-course';
import { UNIT_1_2_COURSE_TITLE, UNIT_1_2_PRESET_KEY, UNIT_1_2_ROUTE_SEGMENT } from '@/lib/unit-1-2-course';
import { UNIT_2_1_COURSE_TITLE, UNIT_2_1_PRESET_KEY, UNIT_2_1_ROUTE_SEGMENT } from '@/lib/unit-2-1-course';
import { UNIT_2_2_COURSE_TITLE, UNIT_2_2_PRESET_KEY, UNIT_2_2_ROUTE_SEGMENT } from '@/lib/unit-2-2-course';
import { UNIT_2_3_COURSE_TITLE, UNIT_2_3_PRESET_KEY, UNIT_2_3_ROUTE_SEGMENT } from '@/lib/unit-2-3-course';
import { UNIT_2_4_COURSE_TITLE, UNIT_2_4_PRESET_KEY, UNIT_2_4_ROUTE_SEGMENT } from '@/lib/unit-2-4-course';
import { UNIT_3_1_COURSE_TITLE, UNIT_3_1_PRESET_KEY, UNIT_3_1_ROUTE_SEGMENT } from '@/lib/unit-3-1-course';
import { UNIT_3_2_COURSE_TITLE, UNIT_3_2_PRESET_KEY, UNIT_3_2_ROUTE_SEGMENT } from '@/lib/unit-3-2-course';
import { UNIT_3_3_COURSE_TITLE, UNIT_3_3_PRESET_KEY, UNIT_3_3_ROUTE_SEGMENT } from '@/lib/unit-3-3-course';
import { UNIT_3_4_COURSE_TITLE, UNIT_3_4_PRESET_KEY, UNIT_3_4_ROUTE_SEGMENT } from '@/lib/unit-3-4-course';
import { UNIT_3_5_COURSE_TITLE, UNIT_3_5_PRESET_KEY, UNIT_3_5_ROUTE_SEGMENT } from '@/lib/unit-3-5-course';
import { UNIT_3_6_COURSE_TITLE, UNIT_3_6_PRESET_KEY, UNIT_3_6_ROUTE_SEGMENT } from '@/lib/unit-3-6-course';
import { UNIT_3_7_COURSE_TITLE, UNIT_3_7_PRESET_KEY, UNIT_3_7_ROUTE_SEGMENT } from '@/lib/unit-3-7-course';
import { UNIT_3_8_COURSE_TITLE, UNIT_3_8_PRESET_KEY, UNIT_3_8_ROUTE_SEGMENT } from '@/lib/unit-3-8-course';
import { UNIT_3_9_COURSE_TITLE, UNIT_3_9_PRESET_KEY, UNIT_3_9_ROUTE_SEGMENT } from '@/lib/unit-3-9-course';
import { UNIT_4_1_COURSE_TITLE, UNIT_4_1_PRESET_KEY, UNIT_4_1_ROUTE_SEGMENT } from '@/lib/unit-4-1-course';
import { UNIT_4_2_COURSE_TITLE, UNIT_4_2_PRESET_KEY, UNIT_4_2_ROUTE_SEGMENT } from '@/lib/unit-4-2-course';
import { UNIT_4_3_COURSE_TITLE, UNIT_4_3_PRESET_KEY, UNIT_4_3_ROUTE_SEGMENT } from '@/lib/unit-4-3-course';
import { UNIT_4_4_COURSE_TITLE, UNIT_4_4_PRESET_KEY, UNIT_4_4_ROUTE_SEGMENT } from '@/lib/unit-4-4-course';
import { UNIT_4_5_COURSE_TITLE, UNIT_4_5_PRESET_KEY, UNIT_4_5_ROUTE_SEGMENT } from '@/lib/unit-4-5-course';
import { UNIT_4_6_COURSE_TITLE, UNIT_4_6_PRESET_KEY, UNIT_4_6_ROUTE_SEGMENT } from '@/lib/unit-4-6-course';
import { UNIT_4_7_COURSE_TITLE, UNIT_4_7_PRESET_KEY, UNIT_4_7_ROUTE_SEGMENT } from '@/lib/unit-4-7-course';
import { UNIT_5_1_COURSE_TITLE, UNIT_5_1_PRESET_KEY, UNIT_5_1_ROUTE_SEGMENT } from '@/lib/unit-5-1-course';
import { UNIT_5_2_COURSE_TITLE, UNIT_5_2_PRESET_KEY, UNIT_5_2_ROUTE_SEGMENT } from '@/lib/unit-5-2-course';
import { UNIT_5_3_COURSE_TITLE, UNIT_5_3_PRESET_KEY, UNIT_5_3_ROUTE_SEGMENT } from '@/lib/unit-5-3-course';
import { UNIT_5_4_COURSE_TITLE, UNIT_5_4_PRESET_KEY, UNIT_5_4_ROUTE_SEGMENT } from '@/lib/unit-5-4-course';
import { UNIT_5_5_COURSE_TITLE, UNIT_5_5_PRESET_KEY, UNIT_5_5_ROUTE_SEGMENT } from '@/lib/unit-5-5-course';
import { UNIT_5_6_COURSE_TITLE, UNIT_5_6_PRESET_KEY, UNIT_5_6_ROUTE_SEGMENT } from '@/lib/unit-5-6-course';

export type InteractiveLessonIdentityAliasKind =
  | 'canonicalId'
  | 'routeSegment'
  | 'runtimeLessonDir'
  | 'lessonKey'
  | 'presetKey'
  | 'planTitleAlias'
  | 'evidenceAlias';

export interface InteractiveLessonIdentityRecord {
  canonicalId: string;
  routeSegments: readonly string[];
  runtimeLessonDir: string;
  lessonKeys: readonly string[];
  presetKeys: readonly string[];
  planTitleAliases: readonly string[];
  evidenceAliases: readonly string[];
}

export type InteractiveLessonIdentityResolution =
  | {
    status: 'resolved';
    record: InteractiveLessonIdentityRecord;
    matchedAlias: {
      kind: InteractiveLessonIdentityAliasKind;
      value: string;
    };
  }
  | {
    status: 'unsupported';
    requested: string;
    reason: 'empty' | 'unknown' | 'ambiguous';
  };

type ResolverInput = string | {
  kind?: InteractiveLessonIdentityAliasKind;
  value: string | null | undefined;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeAlias(value: string | null | undefined) {
  return String(value ?? '').trim();
}

function normalizePlanTitle(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[（(]副本[）)]$/, '')
    .replace(/[：:]/g, '：');
}

function unitRecord(
  canonicalId: string,
  routeSegment: string,
  presetKey: string,
  courseTitle: string,
  extraPlanAliases: string[] = [],
): InteractiveLessonIdentityRecord {
  return {
    canonicalId,
    routeSegments: [routeSegment],
    runtimeLessonDir: canonicalId,
    lessonKeys: [presetKey],
    presetKeys: [presetKey],
    planTitleAliases: unique([courseTitle, ...extraPlanAliases]),
    evidenceAliases: unique([canonicalId, routeSegment, presetKey]),
  };
}

export const INTERACTIVE_LESSON_IDENTITY_REGISTRY: readonly InteractiveLessonIdentityRecord[] = [
  {
    canonicalId: 'cruise-comfort-boppps',
    routeSegments: ['cruise-comfort-boppps'],
    runtimeLessonDir: 'cruise-comfort-boppps',
    lessonKeys: [CRUISE_PRESET_KEY, 'cruise-comfort-boppps'],
    presetKeys: [CRUISE_PRESET_KEY],
    planTitleAliases: [
      CRUISE_COURSE_TITLE,
      '柔性之海——豪华邮轮的舒适度控制',
    ],
    evidenceAliases: ['cruise-comfort-boppps', CRUISE_PRESET_KEY],
  },
  {
    canonicalId: '1-1',
    routeSegments: [UNIT_1_1_ROUTE_SEGMENT],
    runtimeLessonDir: '1-1',
    lessonKeys: [UNIT_1_1_LESSON_KEY, UNIT_1_1_PRESET_KEY],
    presetKeys: [UNIT_1_1_PRESET_KEY],
    planTitleAliases: unique([
      UNIT_1_1_COURSE_TITLE,
      '1-1：看见整门课：从反馈思想到控制全景',
      '看见整门课：从反馈思想到控制全景',
    ]),
    evidenceAliases: unique(['1-1', UNIT_1_1_ROUTE_SEGMENT, UNIT_1_1_LESSON_KEY, UNIT_1_1_PRESET_KEY]),
  },
  unitRecord('1-2', UNIT_1_2_ROUTE_SEGMENT, UNIT_1_2_PRESET_KEY, UNIT_1_2_COURSE_TITLE, [
    '1-2：建模：从真实对象到可分析的系统',
    '建模：从真实对象到可分析的系统',
    '建模——从真实对象到可分析的系统',
  ]),
  unitRecord('2-1', UNIT_2_1_ROUTE_SEGMENT, UNIT_2_1_PRESET_KEY, UNIT_2_1_COURSE_TITLE, [
    '2-1：建模与变换语言——从真实对象到统一分析对象',
    '建模与变换语言——从真实对象到统一分析对象',
    '建模与变换语言',
  ]),
  unitRecord('2-2', UNIT_2_2_ROUTE_SEGMENT, UNIT_2_2_PRESET_KEY, UNIT_2_2_COURSE_TITLE, [
    '2-2：时域响应基础——从响应曲线到动态性能指标',
    '时域响应基础——从响应曲线到动态性能指标',
  ]),
  unitRecord('2-3', UNIT_2_3_ROUTE_SEGMENT, UNIT_2_3_PRESET_KEY, UNIT_2_3_COURSE_TITLE, [
    '2-3：频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
    '频率响应基础与 Bode 图初步——从时域现象到频域图形入口',
    '频率响应基础与 Bode 图初步',
  ]),
  unitRecord('2-4', UNIT_2_4_ROUTE_SEGMENT, UNIT_2_4_PRESET_KEY, UNIT_2_4_COURSE_TITLE, [
    '2-4：Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
    'Nyquist 图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别',
    'Nyquist 图与频域指标入口',
  ]),
  unitRecord('3-1', UNIT_3_1_ROUTE_SEGMENT, UNIT_3_1_PRESET_KEY, UNIT_3_1_COURSE_TITLE, [
    '3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
    '纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解',
    '纯极点视角下的稳定、模态与双域近似',
  ]),
  unitRecord('3-2', UNIT_3_2_ROUTE_SEGMENT, UNIT_3_2_PRESET_KEY, UNIT_3_2_COURSE_TITLE, [
    '3-2：劳斯判据——从高阶系统稳定判定到参数可行域',
    '劳斯判据——从高阶系统稳定判定到参数可行域',
    '劳斯判据',
  ]),
  unitRecord('3-3', UNIT_3_3_ROUTE_SEGMENT, UNIT_3_3_PRESET_KEY, UNIT_3_3_COURSE_TITLE, [
    '3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
    '根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移',
    '根轨迹机制与完整法则',
  ]),
  unitRecord('3-4', UNIT_3_4_ROUTE_SEGMENT, UNIT_3_4_PRESET_KEY, UNIT_3_4_COURSE_TITLE, [
    '3-4：根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
    '根轨迹读图与对象化验证——把法则真正用到主图、参数窗口与工程后果上',
    '根轨迹读图与对象化验证',
  ]),
  unitRecord('3-5', UNIT_3_5_ROUTE_SEGMENT, UNIT_3_5_PRESET_KEY, UNIT_3_5_COURSE_TITLE, [
    '3-5：零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
    '零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变',
    '零点引入与动态改善',
  ]),
  unitRecord('3-6', UNIT_3_6_ROUTE_SEGMENT, UNIT_3_6_PRESET_KEY, UNIT_3_6_COURSE_TITLE, [
    '3-6：零点作用与动态改善实验——从性能目标到校正设计',
    '零点作用与动态改善实验——从性能目标到校正设计',
    '零点作用与动态改善实验',
  ]),
  unitRecord('3-7', UNIT_3_7_ROUTE_SEGMENT, UNIT_3_7_PRESET_KEY, UNIT_3_7_COURSE_TITLE, [
    '3-7：型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
    '型别、积分环节与稳态改善——PI 与滞后校正的低频补偿机理',
    '型别、积分环节与稳态改善',
  ]),
  unitRecord('3-8', UNIT_3_8_ROUTE_SEGMENT, UNIT_3_8_PRESET_KEY, UNIT_3_8_COURSE_TITLE, [
    '3-8：频域判别与跨域综合语言',
    '频域判别与跨域综合语言',
  ]),
  unitRecord('3-9', UNIT_3_9_ROUTE_SEGMENT, UNIT_3_9_PRESET_KEY, UNIT_3_9_COURSE_TITLE, [
    '3-9：稳定—动态—稳态综合映射实验',
    '稳定—动态—稳态综合映射实验',
  ]),
  unitRecord('4-1', UNIT_4_1_ROUTE_SEGMENT, UNIT_4_1_PRESET_KEY, UNIT_4_1_COURSE_TITLE, [
    '4-1：设计起点：性能指标体系、工程约束与可行域表达',
    '设计起点：性能指标体系、工程约束与可行域表达',
    '设计起点',
  ]),
  unitRecord('4-2', UNIT_4_2_ROUTE_SEGMENT, UNIT_4_2_PRESET_KEY, UNIT_4_2_COURSE_TITLE, [
    '4-2：控制器选型原理：不同控制结构为何适合不同任务',
    '控制器选型原理：不同控制结构为何适合不同任务',
    '控制器选型原理',
  ]),
  unitRecord('4-3', UNIT_4_3_ROUTE_SEGMENT, UNIT_4_3_PRESET_KEY, UNIT_4_3_COURSE_TITLE, [
    '4-3：经典复合控制的初始方案落地',
    '经典复合控制的初始方案落地：从单结构候选到工程可运行方案',
    '经典复合控制的初始方案落地',
    '4-3：初始方案落地实践：从对象分析到结构组合与首轮验证',
    '初始方案落地实践：从对象分析到结构组合与首轮验证',
    '初始方案落地实践',
  ]),
  unitRecord('4-4', UNIT_4_4_ROUTE_SEGMENT, UNIT_4_4_PRESET_KEY, UNIT_4_4_COURSE_TITLE, [
    '4-4：多目标权衡与控制器优化设计',
    '多目标权衡与控制器优化设计',
  ]),
  unitRecord('4-5', UNIT_4_5_ROUTE_SEGMENT, UNIT_4_5_PRESET_KEY, UNIT_4_5_COURSE_TITLE, [
    '4-5：约束下的优化设计实践',
    '约束下的优化设计实践',
  ]),
  unitRecord('4-6', UNIT_4_6_ROUTE_SEGMENT, UNIT_4_6_PRESET_KEY, UNIT_4_6_COURSE_TITLE, [
    '4-6：场景迁移与方案比较',
    '固定结构优化边界与结构编码入口',
    '场景迁移与方案比较',
  ]),
  unitRecord('4-7', UNIT_4_7_ROUTE_SEGMENT, UNIT_4_7_PRESET_KEY, UNIT_4_7_COURSE_TITLE, [
    '4-7：高保真辨识、设计验证与扰动边界',
    '高保真辨识、设计验证与扰动边界',
    '完整工程设计闭环实践',
  ]),
  unitRecord('5-1', UNIT_5_1_ROUTE_SEGMENT, UNIT_5_1_PRESET_KEY, UNIT_5_1_COURSE_TITLE, [
    '5-1：线性主干的边界',
    '线性主干的边界',
    '饱和、死区、滞回、切换与模型失配',
  ]),
  unitRecord('5-2', UNIT_5_2_ROUTE_SEGMENT, UNIT_5_2_PRESET_KEY, UNIT_5_2_COURSE_TITLE, [
    '5-2：非线性系统的最小分析入口',
    '非线性系统的最小分析入口',
    '局部线性化、相平面与描述函数',
  ]),
  unitRecord('5-3', UNIT_5_3_ROUTE_SEGMENT, UNIT_5_3_PRESET_KEY, UNIT_5_3_COURSE_TITLE, [
    '5-3：从单回路控制到复杂自主系统链路',
    '从单回路控制到复杂自主系统链路',
    'MASS 感知、估计、规划、控制、执行与监督链路',
  ]),
  unitRecord('5-4', UNIT_5_4_ROUTE_SEGMENT, UNIT_5_4_PRESET_KEY, UNIT_5_4_COURSE_TITLE, [
    '5-4：从模型驱动到数据驱动',
    '从模型驱动到数据驱动',
    '数据驱动 MPC 与模型责任分配',
  ]),
  unitRecord('5-5', UNIT_5_5_ROUTE_SEGMENT, UNIT_5_5_PRESET_KEY, UNIT_5_5_COURSE_TITLE, [
    '5-5：从显式控制器到策略学习',
    '从显式控制器到策略学习',
    '策略学习入口、强化学习训练与航向控制安全边界',
  ]),
  unitRecord('5-6', UNIT_5_6_ROUTE_SEGMENT, UNIT_5_6_PRESET_KEY, UNIT_5_6_COURSE_TITLE, [
    '5-6：方法迁移与前沿比较',
    '方法迁移与前沿比较',
    '冷链温控同题任务、预测补偿与策略监督层比较',
  ]),
] as const;

function aliasesForKind(
  record: InteractiveLessonIdentityRecord,
  kind: InteractiveLessonIdentityAliasKind,
): readonly string[] {
  switch (kind) {
    case 'canonicalId':
      return [record.canonicalId];
    case 'routeSegment':
      return record.routeSegments;
    case 'runtimeLessonDir':
      return [record.runtimeLessonDir];
    case 'lessonKey':
      return record.lessonKeys;
    case 'presetKey':
      return record.presetKeys;
    case 'planTitleAlias':
      return record.planTitleAliases;
    case 'evidenceAlias':
      return record.evidenceAliases;
    default:
      return [];
  }
}

function aliasMatches(kind: InteractiveLessonIdentityAliasKind, candidate: string, requested: string) {
  if (kind === 'planTitleAlias') {
    const normalizedRequested = normalizePlanTitle(requested);
    const normalizedCandidate = normalizePlanTitle(candidate);
    return normalizedCandidate.length > 0 && normalizedRequested.startsWith(normalizedCandidate);
  }
  return normalizeAlias(candidate) === normalizeAlias(requested);
}

export function listInteractiveLessonIdentityRecords(): readonly InteractiveLessonIdentityRecord[] {
  return INTERACTIVE_LESSON_IDENTITY_REGISTRY;
}

export function getInteractiveLessonIdentityRecord(canonicalId: string): InteractiveLessonIdentityRecord | null {
  return INTERACTIVE_LESSON_IDENTITY_REGISTRY.find((record) => record.canonicalId === canonicalId) ?? null;
}

export function resolveInteractiveLessonIdentity(input: ResolverInput): InteractiveLessonIdentityResolution {
  const requested = typeof input === 'string' ? input : input.value;
  const value = normalizeAlias(requested);
  if (!value) {
    return { status: 'unsupported', requested: value, reason: 'empty' };
  }

  const requestedKinds: InteractiveLessonIdentityAliasKind[] = typeof input === 'string' || !input.kind
    ? ['canonicalId', 'routeSegment', 'runtimeLessonDir', 'lessonKey', 'presetKey', 'planTitleAlias', 'evidenceAlias']
    : [input.kind];

  const matches = INTERACTIVE_LESSON_IDENTITY_REGISTRY.flatMap((record) => (
    requestedKinds.flatMap((kind) => (
      aliasesForKind(record, kind)
        .filter((alias) => aliasMatches(kind, alias, value))
        .map((alias) => ({ record, matchedAlias: { kind, value: alias } }))
    ))
  ));

  const matchedRecords = new Map(matches.map((match) => [match.record.canonicalId, match]));
  if (matchedRecords.size === 0) {
    return { status: 'unsupported', requested: value, reason: 'unknown' };
  }
  if (matchedRecords.size > 1) {
    return { status: 'unsupported', requested: value, reason: 'ambiguous' };
  }

  return {
    status: 'resolved',
    ...Array.from(matchedRecords.values())[0],
  };
}

export function resolveInteractiveLessonRouteFromPlanTitle(planTitle: string | null | undefined) {
  const resolved = resolveInteractiveLessonIdentity({ kind: 'planTitleAlias', value: planTitle });
  if (resolved.status !== 'resolved') {
    return {
      routeSegment: null,
      isPremiumCourse: false,
      canonicalId: null,
    };
  }

  return {
    routeSegment: resolved.record.routeSegments[0],
    isPremiumCourse: true,
    canonicalId: resolved.record.canonicalId,
  };
}
