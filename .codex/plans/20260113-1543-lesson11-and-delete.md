# Lesson-11 课程资源 + 教案删除功能

## Goal
- 新增 lesson-11 90 分钟线下课程资源（含知识卡片与互动环节），注册为预置教案并在互动学习页可访问；同时在“我的教案”列表三点菜单提供删除教案功能。

## Scope
- In-scope items
  - 解析 PPTX 内容并设计 lesson-11 课程结构与互动组件
  - 新增 lesson-11 资源目录、manifest/types、互动组件与页面入口
  - 资源注册、预置教案注册、系统资源 ID & seed 脚本更新
  - “我的教案”列表三点删除 + 二次确认 + 成功提示 + 列表即时移除
  - 更新 docs/ProjectDescription.md
- Out-of-scope items
  - 新增后端 API（使用已有删除 API）
  - 大规模 UI 重构或主题改版

## Steps
1) 萃取 PPTX 关键信息并梳理 lesson-11 教案与资源结构。
2) 新增 lesson-11 互动组件、manifest/types 与页面；完成资源注册、预置教案注册与相关配置。
3) 实现教案三点删除交互并更新文档与测试。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- lesson-11 预置教案可见并引用正确 registryId，互动学习页可访问。
- 课程包含知识卡片与互动环节，BOPPPS 时长合计 90 分钟。
- “我的教案”三点菜单可删除，二次确认、成功提示、列表即时更新。
