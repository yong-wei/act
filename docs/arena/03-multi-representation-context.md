# Arena V2 任务 03：Arena 到多表征工作台上下文注入

> 面向执行代理：本任务修复核心断点。`workspace-routing.ts` 已能把 `arenaTask` 放入 URL；多表征工作台必须解析并消费该上下文。

## 目标

从 `/arena/challenges/[taskId]` 进入 `/interactive-learning/multi-representation-linkage?arenaTask=...` 后，工作台加载挑战对象、任务目标、允许方法和评价准则；`arenaTask` 无效时显示错误，不回退默认模型。

## 依赖

- 任务 02 已提供 `resolveArenaWorkbenchContext(taskId)` 和能力矩阵。

## 触及文件

```text
src/app/interactive-learning/multi-representation-linkage/page.tsx
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/features/interactive/multi-representation-linkage/parameter-drawer.tsx
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
```

## 执行步骤

- [ ] 扩展 `MultiRepresentationInitialParams`：

```ts
export interface MultiRepresentationInitialParams {
  courseMode?: boolean;
  role?: 'teacher' | 'student';
  embed?: boolean;
  controlMode?: CruiseControllerMode;
  controller?: Partial<CruiseControllerParams>;
  arenaTaskId?: string;
}
```

- [ ] 在 `page.tsx` 的参数解析中读取：

```ts
arenaTaskId: firstValue(searchParams?.arenaTask)
```

- [ ] 在 `useMultiRepresentationLinkageModel(initialParams)` 中解析 Arena 上下文：

```ts
const arenaContext = initialParams.arenaTaskId
  ? resolveArenaWorkbenchContext(initialParams.arenaTaskId)
  : null;
```

- [ ] 增加错误规则：

```text
存在 arenaTask 且上下文加载成功：进入 challenge mode。
存在 arenaTask 但上下文加载失败：显示“挑战上下文加载失败，请从竞技场重新进入”。
不存在 arenaTask：保留原自由探索和课程模式。
arenaTask 与 courseMode 同时出现：显示语义冲突错误，不能混合。
```

- [ ] 扩展 `buildLinkageAnalysisRequest`，允许直接传入 Arena plant：

```ts
plant?: ControlAnalysisRequest['plant'];
caseId?: string;
```

默认仍使用 poles/zeros/gain；Arena challenge mode 下使用 `object.model.numerator` 和 `object.model.denominator`。

- [ ] 挑战模式下锁定对象编辑：

```text
不能添加或删除开环极点；
不能拖动对象极点或零点；
可以调整 PID 或校正器参数；
reset 恢复挑战对象；
响应类型切换只作为探索，不改变官方任务目标。
```

- [ ] 修复分析缓存匹配逻辑。若使用 plant 注入，匹配依据必须包含 `caseId`、plant 分子分母和结构参数，不能只比较 poles/zeros。
- [ ] 在 `page-client.tsx` 增加 `ArenaChallengeContextBar`，显示任务、对象、模型表达、来源、公开程度、允许方法、评价指标、锁定状态和返回挑战详情链接。
- [ ] 为无效 `arenaTask`、有效白箱任务、自由探索入口、邮轮课程嵌入入口写测试。

## 验证命令

```bash
rtk npm run test:unit -- src/features/interactive/__tests__/multi-representation-arena-context.test.tsx
rtk npm run test:unit -- src/features/arena/__tests__/workbench-context.test.ts
rtk npm run lint
```

有浏览器验收条件时再执行本地页面验证。

## 验收条件

- 访问 `/interactive-learning/multi-representation-linkage?arenaTask=task-second-order-lead-pid` 显示该挑战上下文。
- 页面对象为 `G(s)=16/(s^2+2.4s+16)` 或 seed 中对应的任务对象，不再显示默认邮轮模型。
- 顶部显示任务名、对象名、评价指标和允许方法。
- 挑战模式下对象编辑被锁定，控制器参数仍可调整。
- 无效 `arenaTask` 不回退默认模型。
- 没有 `arenaTask` 时原自由探索和课程嵌入路径不回归。

