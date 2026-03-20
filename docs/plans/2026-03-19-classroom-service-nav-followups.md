# Classroom Service And Navigation Follow-ups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复课堂服务链路与 L-sum 回归，统一学生端提交锁定反馈，执行 `nevplan` 导航修复，并补齐引入 Redis/worker 后的本地启动脚本。

**Architecture:** 先确认课堂服务是否仍残留 SSE 实时链路，再通过文本级失败测试固定“只保留轮询、页面不显示实时连接错误、提交成功常驻且锁定、L-sum 第10页控灵入口文案、启动脚本带 worker、导航统一化”这些行为。之后用最小改动修复会话 hook、课程表单、控灵消息 UI、导航组件与运维脚本，并做针对性验证。

**Tech Stack:** Next.js 14, React, TypeScript, NextAuth, Prisma, Redis, BullMQ worker, Node assertion scripts.

### Task 1: 根因确认与范围收敛

**Files:**
- Inspect: `src/features/interactive/session-framework/use-student-lesson-session.ts`
- Inspect: `src/features/interactive/session-framework/use-session-sse.ts`
- Inspect: `src/app/api/session/[sessionId]/stream/route.ts`
- Inspect: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Inspect: `src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx`
- Inspect: `src/features/interactive/lsum-design-feasible-domain/step-panels.tsx`
- Inspect: `scripts/ops/start.sh`
- Inspect: `scripts/README.md`
- Inspect: `docs/plans/nevplan.md`

**Step 1: 确认课堂服务链路是否仍启用 SSE**

Run: `rg -n "useSessionSSE|enableSSE|EventSource|实时连接失败|轮询模式" src -S`
Expected: 锁定前端默认启用 SSE 与错误文案暴露的位置。

**Step 2: 确认第10页提交链路**

Run: 阅读 `LSUMStudentActivityForm`、`LSUMTeacherActivitySummary`、`/api/session/[sessionId]/state`
Expected: 明确学生提交是否落库，以及教师端读取是否命中了同一数据结构。

**Step 3: 确认 `nevplan` 目标页仍未恢复**

Run: 阅读知识图谱、评审入口、跨域探索、互动课程、章节组件、Lesson-02 等页面
Expected: 确认哪些页面仍使用旧导航或硬编码深色样式。

### Task 2: 失败测试

**Files:**
- Modify: `scripts/tests/test-lsum-session-regression.mjs`
- Modify: `scripts/tests/test-lsum-assessment-controls.ts`
- Create: `scripts/tests/test-classroom-followups.mjs`
- Create: `scripts/tests/test-navigation-unification.mjs`

**Step 1: 写课堂服务与提交锁定失败测试**

覆盖：
- 学生会话 hook 默认不启用 SSE，也不再返回“实时连接失败，已降级到轮询模式”
- L-sum 第10页按钮文案为“打开控灵助手”
- 互动表单存在“提交成功”常驻态和锁定逻辑
- 启动脚本会拉起 Next.js 之外的 worker/scheduler

**Step 2: 写 `nevplan` 导航回归测试**

覆盖：
- 目标页接入统一顶部导航/驾驶舱入口
- 7 个仿真页返回文案为“返回仿真入口”
- 控灵浮动按钮位置下调

**Step 3: 运行新测试并确认先失败**

Run:
- `node scripts/tests/test-classroom-followups.mjs`
- `node scripts/tests/test-navigation-unification.mjs`
Expected: 在当前代码上失败，且失败原因对应真实需求缺口。

### Task 3: 最小修复

**Files:**
- Modify: `src/features/interactive/session-framework/use-student-lesson-session.ts`
- Modify: `src/features/interactive/session-framework/use-session-sse.ts` (如仍需保留兼容入口则仅降级为显式 opt-in)
- Modify: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Modify: `src/features/interactive/lsum-design-feasible-domain/step-panels.tsx`
- Modify: `src/features/interactive/l2a-time-domain/step-panels.tsx`
- Modify: `src/features/interactive/l2b-root-locus/step-panels.tsx`
- Modify: `src/features/interactive/l2c-frequency-bode/step-panels.tsx`
- Modify: `src/features/interactive/l2d-three-domain-linkage/step-panels.tsx` and/or student page
- Modify: `src/components/ai/global-ai-sidebar.tsx`
- Modify: `src/components/ai/konling-sidebar.tsx`
- Create: `src/components/shared/unified-top-bar.tsx`
- Create/Modify: 驾驶舱入口组件（可与统一顶部导航合并）
- Modify: `src/app/knowledge/page.tsx`
- Modify: `src/app/review/page.tsx`
- Modify: `src/app/interactive-learning/page.tsx`
- Modify: `src/app/interactive-learning/courses/page.tsx`
- Modify: `src/app/interactive-learning/cross-domain-exploration/page.tsx`
- Modify: `src/app/interactive-learning/chapter-components/page.tsx`
- Modify: `src/app/interactive-learning/lesson-02/page.tsx`
- Modify: `src/lib/ai-theme-styles.ts`
- Modify: `scripts/ops/start.sh`
- Modify: `scripts/ops/stop.sh`
- Modify: `scripts/README.md`

**Step 1: 关闭默认 SSE 并清除页面错误文案**

实现：
- 学生端默认纯轮询
- 页面不再显示“实时连接失败，已降级到轮询模式”
- 如保留 SSE，只允许显式 opt-in 使用

**Step 2: 统一课程提交成功与锁定态**

实现：
- 学生首次提交后显示“提交成功”
- 成功态常驻
- 已提交表单禁用重复编辑和重复提交
- 教师端仍能读取并汇总现有数据

**Step 3: 修复 L-sum 第10页和控灵消息头像**

实现：
- 第10页按钮文案改为“打开控灵助手”
- 聊天气泡中的控灵头像稳定显示
- 第10页文本提交能被教师端汇总读到

**Step 4: 执行 `nevplan` 导航修复**

实现：
- 新建统一顶部导航组件
- 目标页接入统一导航与驾驶舱入口
- 7 个仿真页返回文案恢复
- 浅色模式可读性修复
- 控灵按钮位置下调

**Step 5: 更新本地启动脚本**

实现：
- 启动脚本拉起前端与新增 worker/scheduler
- 停止脚本回收对应 PID
- README 同步说明 Redis/worker 背景服务

### Task 4: 验证与文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行针对性测试**

Run:
- `node scripts/tests/test-classroom-followups.mjs`
- `node scripts/tests/test-navigation-unification.mjs`
- `node scripts/tests/test-lsum-session-regression.mjs`
- `npx tsx scripts/tests/test-lsum-assessment-controls.ts`
- `npm run lint`
- `npm run test`

**Step 2: 按需运行构建**

Run: `npm run build`
Expected: 退出码为 0。

**Step 3: 更新文档**

Modify: `docs/ProjectDescription.md`
Expected: 记录课堂服务模式、提交锁定提示、导航统一化和启动脚本更新。
