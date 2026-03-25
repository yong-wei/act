# Lesson 15 串联校正与滞后超前

## Goal
- 基于 22/23 课件设计 90 分钟线下课程资源，落地到互动学习与预置教案，并绑定知识图谱节点。

## Scope
- In-scope: lesson-15 资源组件、互动学习页面、预置教案、知识节点与 MDX、资源注册与系统资源清单、项目说明更新
- Out-of-scope: 数据库实际写入/迁移、UI 视觉重构、既有课程调整

## Steps
1) 解析课件要点并设计 lesson-15 课程结构与知识卡片内容。
2) 新增 lesson-15 资源组件与互动学习入口，并在 resource registry 注册。
3) 新增知识图谱节点与 MDX 内容，更新预置教案与系统资源清单。
4) 更新文档与课程入口，运行 lint/test/build/integration 并汇报结果。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- lesson-15 在互动学习页面可访问，模块可加载。
- 预置教案可克隆，BOPPPS 结构完整且时长 90 分钟。
- 知识卡片绑定到新增知识节点并在 seed 脚本可同步。
- 文档更新且测试全通过。
