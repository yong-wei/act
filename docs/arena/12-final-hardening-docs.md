# Arena V2 任务 12：最终加固、文档与验收

> 面向执行代理：本任务是收口，不引入新的功能范围。只修验证暴露的问题、同步文档和记录最终状态。

## 目标

确保 Arena V2 从大厅到挑战详情、工作台、官方评测、榜单、黑箱实验、数据治理、教师发布和高级工作台入口形成可验证闭环，文档与代码一致。

## 依赖

- 任务 01-11 已完成或明确记录不可完成项。

## 触及文件

```text
docs/arena.md
docs/ProjectDescription.md
docs/memory/02-recent-summary.md
docs/memory/20-architecture/arena.md
docs/arena/execution-log.md
src/features/arena/__tests__/*
src/features/interactive/__tests__/*
src/app/api/arena/**/__tests__/*
```

## 执行步骤

- [ ] 汇总所有阶段执行记录，形成最终状态表：

```text
阶段
提交
核心改动
验证命令
结果
剩余风险
```

- [ ] 更新 `docs/arena.md`，只记录已实现事实和明确边界，不写夸张承诺。
- [ ] 更新 `docs/ProjectDescription.md` 中 Arena 当前结构，包括：

```text
对象库
挑战任务
工作台上下文
ControllerArtifact
ArenaEvaluationRun
ArenaSubmission
黑箱实验
虚拟仿真预演
榜单
数据治理
```

- [ ] 必要时新增 `docs/memory/20-architecture/arena.md`，作为后续代理的架构入口。
- [ ] 若更新 `docs/memory/02-recent-summary.md`，只写稳定可复用事实，不把临时失败细节堆进去。
- [ ] 检查测试覆盖：

```text
Arena domain integrity
workbench context parser
multi-representation challenge mode
whitebox evaluation
submission persistence
leaderboard modes
blackbox budget and ownership
virtual simulation preview
telemetry event
teacher configuration
```

- [ ] 执行最终验证命令。

## 最终验证命令

按顺序执行：

```bash
rtk npm run test:unit -- src/features/arena
rtk npm run test:unit -- src/features/interactive
rtk npm run lint
rtk npm run test
rtk npm run build
```

若涉及 Prisma：

```bash
rtk npx prisma validate
```

若需要浏览器验收，覆盖：

```text
/arena 筛选任务
/arena/challenges/[taskId] 查看详情
进入多表征工作台
显示挑战上下文
调整控制器
提交官方评测
回到榜单看到结果
黑箱任务运行实验和预演
教师发布班级挑战
```

## 验收条件

- `/arena` 大厅能筛选并展示挑战任务。
- `/arena/challenges/[id]` 展示对象、指标、榜单、工作台入口和提交入口。
- 白箱多表征任务从 Arena 进入时加载正确挑战模型，不回退默认模型。
- 多表征工作台能生成 `ControllerArtifact` 并提交官方评测。
- `/api/arena/evaluate` 是唯一正式成绩入口。
- 榜单基于真实 `ArenaSubmission`。
- 黑箱实验有预算、有归属校验、有预演和正式提交边界。
- Arena 核心事件进入 `InteractionLog`，并能进入学习证据链。
- 教师端可发布至少一种 Arena 作业挑战。
- Control Odyssey 可作为 Arena 任务来源，但不污染原游戏体系。
- 文档、测试和项目说明同步更新。
- 若有未通过测试，必须明确列出是否为本轮引入；本轮引入的问题必须修复。

