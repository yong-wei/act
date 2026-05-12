# 项目文档入口

`docs/` 只保留当前维护仍需要直接读取的项目文档。历史计划、旧规格、迁移草案和一次性协作记录已经归档到 `docs/archive/`，避免与当前真实状态混在同一层级。

## 当前文档

- [ProjectDescription.md](./ProjectDescription.md)：项目现状、核心架构、主要功能和运行链路。
- [memory/](./memory/00-index.md)：项目长期记忆入口，供本地代理和 ChatGPT 递归读取稳定上下文。
- [Simulation_Guidelines.md](./Simulation_Guidelines.md)：虚拟仿真与控制数值内核规范。
- [arena.md](./arena.md)：Arena 控制竞技场设计与评测边界。
- [interactive-lesson-modularization-status-and-refactor-plan.md](./interactive-lesson-modularization-status-and-refactor-plan.md)：互动课程 manifest 化改造现状与计划。

## 专题目录

- `courses/`：历史课件、课程资源和授课计划资料。
- `case-report/`：案例申报材料和配套资源。
- `archive/legacy-docs/`：过时规格、旧迁移说明、历史工具说明和一次性设计草稿。
- `archive/plans/`：历史执行计划。
- `archive/superpowers/`：旧 superpowers 计划和规格记录。

## 维护规则

- 新增长期有效文档时，优先放在明确专题目录中，并在本页登记。
- 一次性执行计划、阶段草稿和已被实现取代的设计说明放入 `docs/archive/` 的对应子目录。
- 当前项目事实以 `ProjectDescription.md` 为准；跨会话稳定经验沉淀到 `docs/memory/`。
