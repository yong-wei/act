# Arena V2 任务 08：黑箱实验与虚拟仿真预演闭环

> 面向执行代理：黑箱实验、辨识模型、虚拟仿真预演和正式提交必须分层。预演结果不能进入正式榜单。

## 目标

把黑箱挑战升级为“实验数据集 -> 辨识模型引用 -> 控制器工件 -> 虚拟仿真预演 -> 官方评测”的最小闭环，并保持预算和数据集归属校验。

## 依赖

- 任务 02 已区分白箱、黑箱、虚拟仿真能力。
- 任务 07 榜单只消费正式 `ArenaSubmission`。

## 触及文件

```text
src/features/arena/blackbox/experiment-service.ts
src/features/arena/blackbox/experiment.ts
src/features/arena/blackbox/controller-preview.ts
src/features/arena/adapters/plant-adapter.ts
src/features/arena/submissions/arena-blackbox-submission-panel.tsx
src/features/arena/submissions/blackbox-artifact-builder.ts
src/app/api/arena/blackbox-experiments/route.ts
src/app/api/arena/virtual-simulation-runs/route.ts
src/features/arena/__tests__/arena-blackbox-experiment.test.ts
src/features/arena/__tests__/arena-blackbox-evaluation.test.ts
src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts
```

## 执行步骤

- [ ] 新增 `plant-adapter.ts`：

```ts
export interface ArenaPlantAdapter {
  canRunPublicExperiment(input: { task: ChallengeTask; object: ChallengeObject }): boolean;
  runPublicExperiment(input: ArenaBlackBoxExperimentInput): Promise<ArenaBlackBoxExperimentDataset>;
  canRunOfficialEvaluation(input: { task: ChallengeTask; object: ChallengeObject }): boolean;
  runOfficialEvaluation(input: {
    task: ChallengeTask;
    object: ChallengeObject;
    artifact: ControllerArtifact;
  }): Promise<ArenaEvaluationResult>;
}
```

- [ ] 将当前 `runArenaBlackBoxExperiment` 纳入具体 adapter，不让实验逻辑散落在 API route。
- [ ] 保留每日预算，继续使用事务检查预算。现有每日预算常量为 `ARENA_BLACKBOX_DAILY_EXPERIMENT_BUDGET = 20` 时，不擅自修改数值。
- [ ] 黑箱提交必须引用：

```text
experimentDatasetHash
identificationModelId
```

并保持现有所有权校验：dataset 必须属于当前 user 和当前 task。

- [ ] UI 展示：

```text
今日实验预算：已用 / 剩余
最近数据集 hash
信号类型
采样点数
辨识模型 ID
```

- [ ] 虚拟仿真预演调用 `/api/arena/virtual-simulation-runs`，返回轨迹、约束违反、控制能量和平滑度摘要。
- [ ] 页面明确文案：

```text
虚拟仿真预演用于观察闭环行为；正式排名只消费 /api/arena/evaluate 的官方提交。
```

- [ ] 防止伪造 dataset：

```text
非本人 datasetHash 不能提交；
datasetHash 与 identificationModelId 不匹配不能提交；
其他 task 的 datasetHash 不能提交；
```

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts
rtk npm run test:unit -- src/app/api/arena/blackbox-experiments/__tests__/route.test.ts src/app/api/arena/virtual-simulation-runs/__tests__/route.test.ts
rtk npm run lint
```

若 schema 或 Prisma 访问改变：

```bash
rtk npx prisma validate
```

## 验收条件

- 黑箱任务能从详情页进入实验或虚拟仿真入口。
- 学生能运行受预算限制的黑箱实验。
- 数据集归属校验有效，非本人数据集不能提交。
- 黑箱控制器 artifact 引用 datasetHash 和 identificationModelId。
- 虚拟仿真预演不创建正式 `ArenaSubmission`。
- 黑箱任务官方提交仍通过 `/api/arena/evaluate`。
- API 和服务层测试覆盖预算、归属、伪造引用和预演边界。

