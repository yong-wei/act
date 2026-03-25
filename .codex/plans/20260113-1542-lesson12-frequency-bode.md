# Lesson 12 频率特性与伯德图

## Goal
- 基于课程 16/17 PPT 设计 90 分钟线下课堂资源，并完成预置教案与互动学习入口注册。

## Scope
- In-scope items
  - 课次 lesson-12 的互动组件、静态媒体与知识卡片设计
  - 资源注册、预置教案、知识点种子与互动学习入口
  - 文档更新与测试验收
- Out-of-scope items
  - 现有课程内容重构
  - 其他课次调整

## Steps
1) 设计 lesson-12 的 BOPPPS 流程、知识卡片主题与互动模块清单
2) 实现 lesson-12 互动组件、静态媒体与互动学习页面
3) 注册资源与教案：resource-registry、seed 脚本、预置教案、知识点种子与文档更新
4) 运行 lint/test/build/集成测试并整理结果

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- lesson-12 预置教案可克隆并包含知识卡片与互动环节
- /interactive-learning 可访问 lesson-12 相关资源
- 所有指定测试通过
