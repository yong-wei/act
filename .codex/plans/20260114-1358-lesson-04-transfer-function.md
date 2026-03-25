# Lesson 04 传递函数课程资源

## Goal
- 基于 2.2 传递函数 PPT 设计 90 分钟线下课资源与知识图谱节点，并完成互动学习与预置教案接入。

## Scope
- 新增 lesson-04 互动资源（前测、知识卡片、2 个互动环节、后测、总结）。
- 新增知识图谱节点与 MDX，并在预置教案中绑定。
- 在资源注册表与互动学习页面接入 lesson-04。
- 更新项目说明文档。

## Steps
1) 复用现有课程结构，设计 lesson-04 资源与路由入口，创建对应组件与 manifest。
2) 新增知识图谱节点与 MDX 内容，并写入 seed-all-knowledge 脚本。
3) 注册资源与预置教案，确保教案绑定知识节点与互动资源。
4) 更新互动学习入口与 ProjectDescription。
5) 自检与必要测试记录。

## Tests
- npm run lint
- npm run test
- npm run build

## Acceptance
- lesson-04 资源位于 src/resources/interactive-learning/lesson-04 且可访问。
- 知识卡片与知识图谱节点 ID 对齐，seed 脚本可插入节点。
- 预置教案中包含知识节点与互动资源，符合 BOPPPS。
- 互动学习页与课程列表可看到 lesson-04。
