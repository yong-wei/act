# Arena V2 任务 01：基线核验与任务地图

> 面向执行代理：本任务只建立事实基线和后续改动地图。除必要的执行记录外，不修改业务代码。

## 目标

确认当前分支、现有 Arena 实现、多表征工作台连接状态、Prisma 模型和测试状态，避免后续代理把当前 Arena 误判为从零开发。

## 必读文件

按顺序读取：

```text
docs/memory/CHATGPT_CONTEXT.md
docs/memory/00-index.md
docs/memory/02-recent-summary.md
docs/memory/01-reading-map.md
docs/arenav2.md
docs/arena.md
docs/ProjectDescription.md
src/features/arena/index.ts
src/features/arena/types.ts
src/features/arena/data/seed-challenges.ts
src/features/arena/workspace-routing.ts
src/features/arena/evaluation/evaluator.ts
src/features/arena/evaluation/whitebox-evaluator.ts
src/features/arena/submissions/persistence.ts
src/features/arena/submissions/prisma-store.ts
src/app/api/arena/evaluate/route.ts
src/app/api/arena/blackbox-experiments/route.ts
src/app/api/arena/virtual-simulation-runs/route.ts
src/app/interactive-learning/multi-representation-linkage/page.tsx
src/features/interactive/multi-representation-linkage/model.ts
src/features/interactive/multi-representation-linkage/page-client.tsx
src/resources/control-system/analysis/multi-representation-linkage-analysis.ts
prisma/schema.prisma
```

## 执行步骤

- [ ] 确认分支和工作区：

```bash
rtk git branch --show-current
rtk git status --short
```

以执行时所在的当前分支为准，不切换到旧计划中的固定分支。若当前分支明显不是用户指定的 Arena V2 工作分支，停止并向用户确认。

- [ ] 列出 Arena 现有模块：

```bash
rtk rg --files src/features/arena
rtk rg --files src/app/api/arena src/app/arena
```

- [ ] 核对多表征工作台是否解析 `arenaTask`：

```bash
rtk rg -n "arenaTask|courseMode|controlMode|parseInitialParams" src/app/interactive-learning/multi-representation-linkage src/features/interactive/multi-representation-linkage
```

- [ ] 核对 Arena Prisma 模型：

```bash
rtk rg -n "ArenaControllerArtifact|ArenaEvaluationRun|ArenaSubmission|ArenaBlackBoxExperiment|ArenaVirtualSimulationRun" prisma/schema.prisma src/features/arena
```

- [ ] 运行基线验证：

```bash
rtk npm run test:unit -- src/features/arena
rtk npm run lint
```

若失败，记录失败文件、错误摘要、是否与 Arena 直接相关。

## 交付物

新增或更新执行记录：

```text
docs/arena/execution-log.md
```

记录内容必须包含：

- 当前分支、commit hash、工作区状态。
- Arena 已有模块清单。
- `/arena/challenges/[taskId]` 到工作台的路由状态。
- 多表征工作台当前是否消费 `arenaTask`。
- Prisma Arena 模型状态。
- 基线测试、lint 结果。
- 下一任务建议触及文件清单。

## 验收条件

- 执行记录能解释 Arena 当前不是空白模块。
- 能明确指出 Arena 与多表征工作台的第一个断点。
- 能区分白箱官方评测当前是否仍含启发式估算。
- 后续任务的改动范围有文件级依据。
- 未改动业务代码。
