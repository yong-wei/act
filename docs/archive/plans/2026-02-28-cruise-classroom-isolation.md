# Cruise Classroom Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将精品课程改造为教师/学生真实课堂隔离视图，保留会话数据互通，并完成仿真与多表征联动改造。

**Architecture:** 以 `ClassSession` 与 `StudentState` 现有 API 作为共享数据层；新增课程入口页用于创建/加入课堂；新增教师与学生独立路由分别管理流程与导航；仿真和多表征通过 `window.postMessage`（同页 iframe）进行参数联动，课程模式禁用非本课功能。

**Tech Stack:** Next.js 14 App Router, React Client Components, NextAuth 会话接口, Prisma Session API, Playwright。

### Task 1: 失败测试先行
- 新增/修改 Playwright 用例，覆盖：
  - 互动学习首页可输入课堂码加入该精品课程
  - 精品课程入口页可创建课堂并跳转教师页
  - 学生输入课堂码后跳转学生页
  - 教师页/学生页不再同屏分栏

### Task 2: 课程入口改造
- 新建入口页组件，提供：
  - 教师创建课堂码（clone preset + create session）
  - 学生输入课堂码加入
  - 学生仍可浏览课程说明

### Task 3: 新建教师端独立流程页
- 路由：`/interactive-learning/courses/cruise-comfort-boppps/teacher/[sessionId]`
- 首屏展示课堂码与课堂状态
- 顶部导航统一为“返回 + 标题 + 环节下拉 + 上下步箭头”
- 保留完整环节并推进会话进度到 `/api/session/[id]`

### Task 4: 新建学生端独立流程页
- 路由：`/interactive-learning/courses/cruise-comfort-boppps/student/[sessionId]`
- 前半段（B/O/P1）按学生视图
- 从“工程目标设定”起进入“仿真 + 多表征”双标签全屏工作台
- 中间环节共用该工作台，支持直接跳到收尾总结

### Task 5: 仿真课程模式改造
- 在 `cruise-simulation` 增加课程模式和原生参数控件
- 增加 PID 参数输入并调用 `engine.setPIDGains`
- 增加步骤提示、结构化提示词编辑区、一致性校验输出
- 对外广播控制器参数与目标，支持与多表征同步

### Task 6: 多表征课程模式改造
- 增加课程模式 query 参数
- 禁用“添加极点/零点”及删除按钮
- 支持从 query 或消息注入邮轮模型开环极点/零点与增益
- 收到仿真参数后重算开环/闭环并回传极点状态

### Task 7: 文档与回归
- 更新 `docs/ProjectDescription.md`
- 执行 `npm run lint`、`npm run test`、`npm run build`、目标 Playwright 用例
