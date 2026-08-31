# 项目文档入口

`docs/` 用于保存当前项目说明、长期维护规范、专题合同、验收材料和历史档案。项目当前事实以代码、`openspec/specs/`、当前 `openspec/changes/` 与本页列出的状态文档为准；带日期的报告和归档材料只用于追溯，不作为现状依据。

## 当前文档

- [ProjectDescription.md](./ProjectDescription.md)：项目现状、核心架构、主要功能和运行链路。
- [memory/](./memory/00-index.md)：项目长期记忆入口，供本地代理和 ChatGPT 递归读取稳定上下文。
- [Simulation_Guidelines.md](./Simulation_Guidelines.md)：虚拟仿真与控制数值内核规范。
- [arena.md](./arena.md)：Arena 控制竞技场设计与评测边界。
- [interactive-lesson-modularization-status-and-refactor-plan.md](./interactive-lesson-modularization-status-and-refactor-plan.md)：互动课程 manifest 化改造现状与计划。
- [provider-runtime-compatibility.md](./provider-runtime-compatibility.md)：AI provider 运行时兼容边界。
- [operations/smart-courseware-p0-runbook.md](./operations/smart-courseware-p0-runbook.md)：智能课件确定性发布、隐私边界与根轨迹 P0 验收口径。
- [operations/assignment-grading-closure-and-comparison-tasks.md](./operations/assignment-grading-closure-and-comparison-tasks.md)：教师作业批改闭环、阶段 A/G.8、阶段 B 调优与隐藏验收的当前任务状态。
- [operations/teacher-ai-grading-stage-a-g8-evidence-2026-08-28.md](./operations/teacher-ai-grading-stage-a-g8-evidence-2026-08-28.md)：阶段 A/G.8 的冻结证据与只读重验边界。
- [operations/teacher-ai-grading-stage-b-tuning-result-2026-08-29.md](./operations/teacher-ai-grading-stage-b-tuning-result-2026-08-29.md)：阶段 B V1/V2/V3 前置与历史失败诊断。
- [operations/teacher-ai-grading-stage-b-v4-completion-2026-08-29.md](./operations/teacher-ai-grading-stage-b-v4-completion-2026-08-29.md)：V4 调优集强制完成、人工—AI 聚合指标与隐藏集封存边界。
- [submission-object-operations.md](./submission-object-operations.md)：提交对象的操作合同。
- [data-completeness-audit.md](./data-completeness-audit.md)：数据完整性审计口径。

## 专题目录

- `arena/`：Arena 分阶段设计任务。内容用于架构追溯；实际能力以代码和已归档 OpenSpec 为准。
- `case-report/`：案例申报材料和配套交付物，不参与工程现状判断。
- `courses/`：历史课程资料和授课计划，仅用于内容来源追溯。
- `memory/`：跨会话稳定事实、架构入口和运行经验。
- `proposals/`：已被 OpenSpec 接管前形成的专题提案，仅作来源追溯。
- `superpowers/`：仍有引用价值的阶段性规格和实施记录。
- `archive/legacy-docs/`：过时规格、旧迁移说明、历史工具说明和一次性设计草稿。
- `archive/plans/`：历史执行计划。
- `archive/superpowers/`：旧 superpowers 计划和规格记录。

## 维护规则

- 新增长期有效文档时，优先放在明确专题目录中，并在本页登记。
- 新的一次性执行记录和 PR 交接信息不要进入 `docs/`；应放在 issue、PR 或任务交接记录中。
- 已被 OpenSpec、代码或新合同完全取代且没有审计价值的文档直接删除；仍需追溯的历史材料移入 `docs/archive/`。
- 当前项目事实以 `ProjectDescription.md` 为准；跨会话稳定经验沉淀到 `docs/memory/`。
