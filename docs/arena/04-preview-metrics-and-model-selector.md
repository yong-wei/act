# Arena V2 任务 04：工作台预评测与基础模型选择

> 面向执行代理：本任务只做工作台预评测和模型入口，不改变官方评测成绩来源。

## 目标

在多表征工作台显示当前方案对 Arena 评价准则的预评测结果，并增加基础模型选择面板。挑战模式模型锁定；自由探索模式可选择兼容模型；不兼容对象显示原因和推荐入口。

## 依赖

- 任务 03 已能在多表征工作台拿到 `ArenaWorkbenchContext`。

## 触及文件

```text
src/features/arena/workbench/preview-metrics.ts
src/features/arena/workbench/arena-model-selector-panel.tsx
src/features/arena/workbench/capabilities.ts
src/features/arena/workspace-routing.ts
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
src/features/arena/__tests__/workbench-capabilities.test.ts
```

## 执行步骤

- [ ] 新增 `mapLinkageResultToArenaMetrics(analysis)`，至少映射：

```text
overshoot
settlingTime
steadyStateError
phaseMargin
gainMargin
bandwidth
```

若 `itae`、`controlEnergy` 等当前分析结果未提供，返回缺失状态，不编造数值。

- [ ] 复用 `src/features/arena/evaluation/scoring.ts` 中的评分函数。预评测不得在 UI 中另写评分公式。
- [ ] 新增 `ArenaWorkbenchPreviewSummary`：

```ts
export interface ArenaWorkbenchPreviewSummary {
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    unit?: string;
    satisfaction: number | null;
    status: 'pass' | 'warning' | 'fail' | 'unknown';
  }>;
  previewScore: number | null;
  missingOfficialOnlyMetrics: string[];
}
```

- [ ] 在顶部性能栏显示当前方案表现，并明确标注：

```text
工作台预评测，不等同于官方榜单成绩。
```

- [ ] 新增 `ArenaModelSelectorPanel`，模型来源只使用 `ARENA_CHALLENGE_OBJECTS`，不新建模型清单。
- [ ] 模型按来源分组：

```text
典型对象
作业对象
控制奥德赛
虚拟仿真对象
前沿拓展对象
```

- [ ] challenge mode 下只显示当前模型详情，不允许切换；提供返回挑战详情和脱离挑战进入自由探索入口。
- [ ] free explore mode 下允许选择兼容白箱 SISO LTI 传递函数对象。
- [ ] 不兼容对象不得静默隐藏，显示原因：

```text
非白箱：不能显示根轨迹/Bode。
非 SISO LTI：多表征串联面板不支持。
黑箱：进入辨识工作台。
MPC：进入预测控制工作台。
```

跳转路径复用 `getArenaWorkspaceHref`。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/workbench-capabilities.test.ts src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
rtk npm run lint
```

## 验收条件

- 从 Arena 进入多表征工作台后，顶部显示任务评价指标和预评测状态。
- 调整 PID 或串联校正参数后，预评测指标随分析结果更新。
- 缺失指标显示“官方评测计算”或等价明确状态，不显示假数。
- challenge mode 下模型锁定。
- free explore mode 下可选择兼容白箱模型。
- 黑箱或虚拟仿真对象显示不兼容原因和推荐工作台入口。
- 切换自由探索模型不会污染 challenge submission。

