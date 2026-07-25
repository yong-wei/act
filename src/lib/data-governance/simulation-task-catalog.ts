/**
 * 只读仿真任务目录
 *
 * 从既有奥德赛关卡、Arena 挑战、资源注册表和控制工作台定义汇集
 * 当前已发布且可供学生完成的任务，提供稳定任务键、来源、显示名称、
 * 完成规则和展示分组。不新增数据库表或 retired/tombstone 目录。
 */

import { CONTROL_ODYSSEY_LEVELS } from '@/resources/interactive-learning/control-odyssey/level-data';
import { ARENA_CHALLENGE_TASKS } from '@/features/arena/data/seed-challenges';
import { getArenaTaskForOdysseyLevel } from '@/features/arena/odyssey/assignment';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SimulationTaskSource =
  | 'odyssey'
  | 'arena'
  | 'virtual-simulation'
  | 'control-workbench';

export type SimulationTaskCompletionRule =
  | { kind: 'arena-accepted-submission'; predicateId: string }
  | { kind: 'odyssey-persistent-clear' }
  | { kind: 'distinct-valid-runs'; requiredCount: number };

export interface SimulationTaskCatalogEntry {
  /** 稳定任务标识，格式 `${source}:${taskId}` */
  taskKey: string;
  source: SimulationTaskSource;
  /** 来源内部任务标识 */
  sourceTaskId: string;
  /** 学生可见名称 */
  displayName: string;
  /** 当前是否已发布且可供学生完成 */
  published: boolean;
  /** 来源级完成规则 */
  completionRule: SimulationTaskCompletionRule;
  /** 展示分组 */
  displayGroup: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SIMULATION_TASK_CATALOG_VERSION = 'simulation-task-catalog.v1';

/** 通用虚拟仿真任务键（无法恢复具名任务时使用） */
export const GENERIC_VIRTUAL_SIMULATION_TASK_KEY = 'virtual-simulation:generic';

/** 自由控制工作台通用任务键 */
export const GENERIC_CONTROL_WORKBENCH_TASK_KEY = 'control-workbench:free';

/** 通用任务需要的不同有效运行数 */
export const GENERIC_TASK_DISTINCT_RUNS_REQUIRED = 3;

// ─── Catalog Construction ────────────────────────────────────────────────────

function buildOdysseyEntries(): SimulationTaskCatalogEntry[] {
  return CONTROL_ODYSSEY_LEVELS
    .map((level) => ({
      taskKey: `odyssey:${level.id}`,
      source: 'odyssey' as const,
      sourceTaskId: level.id,
      displayName: level.name,
      published: true,
      completionRule: { kind: 'odyssey-persistent-clear' as const },
      displayGroup: '控制奥德赛',
    }));
}

function buildArenaEntries(): SimulationTaskCatalogEntry[] {
  return ARENA_CHALLENGE_TASKS
    .filter((task) => task.metricProfileId.trim().length > 0)
    .map((task) => ({
      taskKey: `arena:${task.id}`,
      source: 'arena',
      sourceTaskId: task.id,
      displayName: task.title,
      published: true,
      completionRule: {
        kind: 'arena-accepted-submission' as const,
        predicateId: task.metricProfileId,
      },
      displayGroup: 'Arena 挑战',
    }));
}

function buildVirtualSimulationEntries(): SimulationTaskCatalogEntry[] {
  return getAllRegisteredResourceMetadata()
    .filter((resource) =>
      resource.type === 'SIMULATION_APP'
      && resource.defaultConfig?.resourceKind !== 'arena-workbench'
    )
    .map((resource) => ({
      taskKey: `virtual-simulation:${resource.id}`,
      source: 'virtual-simulation' as const,
      sourceTaskId: resource.id,
      displayName: resource.label,
      published: true,
      completionRule: {
        kind: 'distinct-valid-runs' as const,
        requiredCount: GENERIC_TASK_DISTINCT_RUNS_REQUIRED,
      },
      displayGroup: '虚拟仿真',
    }));
}

function buildGenericEntries(): SimulationTaskCatalogEntry[] {
  return [
    {
      taskKey: GENERIC_VIRTUAL_SIMULATION_TASK_KEY,
      source: 'virtual-simulation',
      sourceTaskId: 'generic',
      displayName: '虚拟仿真（通用）',
      published: true,
      completionRule: { kind: 'distinct-valid-runs', requiredCount: GENERIC_TASK_DISTINCT_RUNS_REQUIRED },
      displayGroup: '虚拟仿真',
    },
    {
      taskKey: GENERIC_CONTROL_WORKBENCH_TASK_KEY,
      source: 'control-workbench',
      sourceTaskId: 'free',
      displayName: '自由控制工作台',
      published: true,
      completionRule: { kind: 'distinct-valid-runs', requiredCount: GENERIC_TASK_DISTINCT_RUNS_REQUIRED },
      displayGroup: '控制工作台',
    },
  ];
}

// ─── Public API ──────────────────────────────────────────────────────────────

let cachedCatalog: readonly SimulationTaskCatalogEntry[] | null = null;

/**
 * 获取当前仿真任务目录（只读、惰性构建、进程内缓存）。
 * 目录仅包含当前已发布且可供学生完成的任务。
 */
export function getSimulationTaskCatalog(): readonly SimulationTaskCatalogEntry[] {
  if (cachedCatalog) return cachedCatalog;
  cachedCatalog = Object.freeze([
    ...buildOdysseyEntries(),
    ...buildArenaEntries(),
    ...buildVirtualSimulationEntries(),
    ...buildGenericEntries(),
  ]);
  return cachedCatalog;
}

const TASK_KEY_MAP = new Map<string, SimulationTaskCatalogEntry>();

function ensureTaskKeyMap(): Map<string, SimulationTaskCatalogEntry> {
  if (TASK_KEY_MAP.size > 0) return TASK_KEY_MAP;
  for (const entry of getSimulationTaskCatalog()) {
    TASK_KEY_MAP.set(entry.taskKey, entry);
  }
  return TASK_KEY_MAP;
}

/** 按 taskKey 查找目录项 */
export function getSimulationTaskByKey(taskKey: string): SimulationTaskCatalogEntry | undefined {
  return ensureTaskKeyMap().get(taskKey);
}

/**
 * 解析奥德赛关卡的任务键。
 * Arena 指派关卡优先归入 Arena 任务。
 */
export function resolveOdysseyTaskKey(levelId: string, isArenaAssigned: boolean): string | null {
  if (isArenaAssigned) {
    const arenaTaskId = getArenaTaskForOdysseyLevel(levelId);
    if (arenaTaskId) return `arena:${arenaTaskId}`;
  }
  const catalog = getSimulationTaskCatalog();
  const entry = catalog.find((e) => e.source === 'odyssey' && e.sourceTaskId === levelId);
  return entry?.taskKey ?? null;
}

/**
 * 解析 Arena 任务键。仅当挑战具有完成谓词时返回有效键。
 */
export function resolveArenaTaskKey(taskId: string): string | null {
  const key = `arena:${taskId}`;
  const entry = ensureTaskKeyMap().get(key);
  return entry?.published ? key : null;
}

/**
 * 解析虚拟仿真任务键。
 * 具名任务返回对应键；无法恢复具名身份时返回通用虚拟仿真任务键。
 */
export function resolveVirtualSimulationTaskKey(namedTaskId: string | null): string | null {
  if (!namedTaskId?.trim()) return GENERIC_VIRTUAL_SIMULATION_TASK_KEY;
  const key = `virtual-simulation:${namedTaskId}`;
  const entry = ensureTaskKeyMap().get(key);
  return entry?.published ? key : null;
}

/** 获取自由控制工作台通用任务键 */
export function getControlWorkbenchTaskKey(): string {
  return GENERIC_CONTROL_WORKBENCH_TASK_KEY;
}

/**
 * 判断任务是否使用"不同有效运行"完成规则。
 */
export function isDistinctRunsTask(entry: SimulationTaskCatalogEntry): boolean {
  return entry.completionRule.kind === 'distinct-valid-runs';
}

/**
 * 获取目录中所有已发布任务的 taskKey 列表。
 */
export function getPublishedTaskKeys(): string[] {
  return getSimulationTaskCatalog()
    .filter((entry) => entry.published)
    .map((entry) => entry.taskKey);
}
