# Arena V2 任务 02：领域模型、能力矩阵与工作台上下文

> 面向执行代理：本任务扩展现有 Arena 类型体系，不重写、不平行新建领域模型。

## 目标

在 `src/features/arena/types.ts` 和现有 seed 数据基础上，补齐 Arena 工作台上下文、对象能力矩阵和上下文解析函数，使后续工作台、评测、黑箱和教师配置都能复用同一套领域契约。

## 依赖

- `01-baseline-and-map.md` 已完成并记录当前基线。
- 当前 `src/features/arena/index.ts` 仍是统一导出口。

## 触及文件

```text
src/features/arena/types.ts
src/features/arena/index.ts
src/features/arena/data/seed-challenges.ts
src/features/arena/workbench/types.ts
src/features/arena/workbench/capabilities.ts
src/features/arena/workbench/context.ts
src/features/arena/workbench/metric-mapping.ts
src/features/arena/__tests__/workbench-context.test.ts
```

## 执行步骤

- [ ] 新增 `src/features/arena/workbench/types.ts`，定义：

```ts
export type ArenaEntryMode = 'challenge' | 'free-explore' | 'assignment' | 'odyssey' | 'virtual-sim';

export interface ArenaModelCapabilities {
  isLti: boolean;
  isSiso: boolean;
  isMimo: boolean;
  isNonlinear: boolean;
  hasTransferFunction: boolean;
  hasStateSpace: boolean;
  supportsStepResponse: boolean;
  supportsRootLocus: boolean;
  supportsBode: boolean;
  supportsNyquist: boolean;
  supportsSerialCorrection: boolean;
  supportsPid: boolean;
  supportsCompositeControl: boolean;
  supportsIdentification: boolean;
  supportsMpc: boolean;
  supportsVirtualSimulationPreview: boolean;
  supportsOfficialEvaluation: boolean;
}
```

- [ ] 扩展 `ChallengeObject`，只新增字段，不删除既有字段：

```ts
capabilities?: ArenaModelCapabilities;
modelVersion?: string;
modelType?: 'transfer-function' | 'state-space' | 'nonlinear-simulation' | 'virtual-simulation' | 'data-only';
timeRange?: { start: number; end: number; samples: number };
frequencyRange?: { min: number; max: number; samples: number };
workbenchSeed?: {
  poles: Array<{ re: number; im: number }>;
  zeros: Array<{ re: number; im: number }>;
  gain: number;
};
```

- [ ] 新增 `inferArenaObjectCapabilities(object)`，集中判断白箱传函、黑箱虚拟仿真、Control Odyssey、复合框图、MPC 等能力。
- [ ] 新增 `ArenaWorkbenchContext`，至少包含 `entryMode`、`locked`、`task`、`object`、`metricProfile`、`leaderboardPolicy`、`allowedMethods`、`recommendedWorkspaceMode`、`returnHref`、`capabilities`。
- [ ] 新增 `resolveArenaWorkbenchContext(taskId)`，复用现有 task/object/metric/leaderboard 查询函数；任何关键实体缺失时返回 `null`。
- [ ] 给支持多表征工作台的白箱任务补足 `workbenchSeed` 或可推导的传函数据。
- [ ] 从 `src/features/arena/index.ts` 统一导出新增类型和函数。
- [ ] 新增测试覆盖 task 完整性、白箱能力、黑箱能力、缺失 task、allowedMethods 与 workspaceMode 一致性。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/workbench-context.test.ts src/features/arena/__tests__/arena-domain.test.ts
rtk npm run lint
```

## 验收条件

- `resolveArenaWorkbenchContext('task-second-order-lead-pid')` 返回完整 challenge 上下文。
- 白箱传函对象支持根轨迹、Bode、Nyquist、PID、串联校正。
- 黑箱对象不暴露传函分析能力，但支持辨识和虚拟仿真预演能力。
- 每个现有 task 都能找到 object、metric profile、leaderboard policy。
- `src/features/arena/index.ts` 仍是调用方唯一需要引用的 Arena 领域导出口。
