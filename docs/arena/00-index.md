# Arena 架构演进记录索引

> 本目录保存 2026 年 5 月 Arena V2 的分阶段设计记录，仅用于追溯架构决策，不再作为执行清单。当前实现以 `src/features/arena/`、`src/features/control-workbench/`、`docs/arena.md` 和已归档 OpenSpec 为准。

## 总目标

把 Arena 从“已有大厅、挑战详情、提交雏形和评测骨架”推进为控制任务、学生工作台、官方评测、排行榜、黑箱实验、虚拟仿真预演和学习证据之间的统一基础设施。

核心边界：

- Arena 是统一评测与排行榜层，不是某一种串联校正工具。
- 多表征联动工作台只是白箱 SISO LTI 串联校正、PID 与频域设计任务的工作台模式。
- 官方成绩只来自 `/api/arena/evaluate`，前端预评测不能写入正式榜单。
- 任何新能力都应扩展 `src/features/arena/**` 现有体系，不能另建平行的 `competition`、`challenge` 或 `score` 系统。

## 历史任务顺序

| 顺序 | 任务文件 | 目标 | 可并行性 |
| --- | --- | --- | --- |
| 01 | `01-baseline-and-map.md` | 建立当前分支、实现、测试和风险基线 | 必须最先执行 |
| 02 | `02-domain-workbench-context.md` | 稳定 Arena 领域模型、能力矩阵和工作台上下文 | 依赖 01 |
| 03 | `03-multi-representation-context.md` | 打通 `arenaTask` 到多表征工作台的上下文注入 | 依赖 02 |
| 04 | `04-preview-metrics-and-model-selector.md` | 增加预评测指标栏和基础模型选择面板 | 依赖 03 |
| 05 | `05-controller-artifact-and-submission.md` | 从工作台生成 `ControllerArtifact` 并提交官方评测 | 依赖 03、04 |
| 06 | `06-whitebox-evaluation-protocol.md` | 重构白箱官方评测协议和指标 provider | 依赖 02、05 可先后调整 |
| 07 | `07-leaderboards-and-submissions.md` | 规范主榜、方法榜、指标榜、Pareto 榜与提交读取 | 依赖 05、06 |
| 08 | `08-blackbox-and-virtual-simulation.md` | 完成黑箱实验、辨识引用、虚拟仿真预演边界 | 依赖 02、07 |
| 09 | `09-telemetry-data-governance.md` | 将 Arena 高价值事件接入数据治理和学习画像 | 依赖 05、08 |
| 10 | `10-teacher-assignment-mode.md` | 教师发布 Arena 作业挑战并写入班级上下文 | 依赖 07、09 |
| 11 | `11-odyssey-and-advanced-workbenches.md` | 接入 Control Odyssey、复合校正、MPC、优化 PID 工作台边界 | 依赖 06、07 |
| 12 | `12-final-hardening-docs.md` | 文档、测试、迁移和最终验收收口 | 必须最后执行 |

## 当时的执行规则

1. 使用执行时所在的当前分支开发，不固定切到旧计划中的分支；若当前分支异常，先停止并向用户确认。
2. 每个任务独立提交；前置任务未通过验证前，不进入后置任务。
3. 每个任务执行前先运行 `rtk git status --short`，确认是否存在无关脏文件；提交时只暂存本任务文件。
4. 每个任务完成后记录：改动摘要、触及路径、验证命令、失败或通过结果、剩余风险。
5. 若全量测试有既有失败，必须区分“本任务局部绿色”和“仓库全量残留失败”，不得报告为全量通过。
6. 若涉及 Prisma schema，执行 `rtk npx prisma validate`；只有 schema 真变更时才生成 migration。
7. 涉及浏览器主流程时，至少验证 `/arena -> challenge detail -> workspace -> submit/evaluate` 的实际页面行为。

## 通用验证命令

按任务风险选择，不要求每个阶段都全量运行：

```bash
rtk npm run test:unit -- src/features/arena
rtk npm run test:unit -- src/features/interactive
rtk npm run lint
rtk npm run test
rtk npm run build
```

## 禁止事项

- 不得绕过 `/api/arena/evaluate` 直接从前端写排行榜。
- 不得在 UI 组件中实现官方评测算法。
- 不得把 `arenaTask` 解析失败静默回退为默认模型。
- 不得把黑箱对象真实模型暴露给学生端。
- 不得把虚拟仿真预演结果写入正式 `ArenaSubmission`。
- 不得记录参数滑块每次移动这样的高频噪声事件。
- 不得把复合校正、MPC、黑箱控制硬塞进多表征联动工作台。
