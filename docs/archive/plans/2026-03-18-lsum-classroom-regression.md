# L-sum Classroom Regression Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 L-sum 课程在今日课堂服务优化与数据治理改动后出现的演示模式翻页、教师课堂码显示和状态同步报错问题，并回归验证今日新增功能。

**Architecture:** 先按课堂会话主链路定位回归点：`entry-page -> teacher/student page -> use-session-state-channel/use-session-sse -> /api/session/[sessionId]/state & stream`。优先比对 L-sum 与 L-2d/L-2a 的正常实现，再用最小失败用例覆盖回归场景，最后做针对今日提交的功能回归。

**Tech Stack:** Next.js 14, React, TypeScript, Prisma, Playwright, Vitest, SSE, Redis 可选缓存。

### Task 1: 根因调查与复现

**Files:**
- Inspect: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Inspect: `src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx`
- Inspect: `src/features/interactive/session-framework/use-session-state-channel.ts`
- Inspect: `src/features/interactive/session-framework/use-session-sse.ts`
- Inspect: `src/app/api/session/[sessionId]/state/route.ts`
- Inspect: `src/app/api/session/[sessionId]/stream/route.ts`
- Compare: `src/features/interactive/l2d-three-domain-linkage/student-page.tsx`
- Compare: `src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx`

**Step 1: 复现教师端与学生端问题**

Run: 通过本地服务打开 L-sum 教师端与演示模式学生端，记录课堂码缺失、翻页失效和 30s 后控制台报错。

**Step 2: 比对最近提交**

Run: `git log --since='2026-03-18 00:00' --stat --oneline`

Expected: 锁定课堂服务优化、Redis/SSE、数据治理与 L-sum 修复相关提交。

**Step 3: 对照正常课程实现**

Run: 对比 L-sum 与 L-2d/L-2a 在会话初始化、同步、演示模式分支上的差异。

Expected: 明确哪个链路在 L-sum 上偏离了可工作的模式。

### Task 2: 失败用例

**Files:**
- Create/Modify: `src/features/interactive/session-framework/__tests__/...`
- Create/Modify: `src/app/api/session/[sessionId]/state/__tests__/...`

**Step 1: 写最小失败测试**

覆盖：
- 演示模式不应持续向 `/api/session/:id/state` 写入状态
- 教师端应能读取 `joinCode`
- 课堂会话长时间停留时不应触发无界 POST 风暴

**Step 2: 运行测试确认失败**

Run: 针对新增测试的 `vitest` 命令

Expected: 失败原因与回归现象一致，而不是测试本身错误。

### Task 3: 最小修复

**Files:**
- Modify: `src/features/interactive/session-framework/use-session-state-channel.ts`
- Modify: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Modify: `src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx`
- Modify: `src/app/api/session/[sessionId]/state/route.ts`
- Optional: `src/features/interactive/session-framework/use-session-sse.ts`

**Step 1: 按根因做单点修复**

限制状态写回条件、修正教师端会话信息读取或课堂码映射、恢复 L-sum 演示模式翻页逻辑。

**Step 2: 重跑失败测试**

Expected: 新测试通过。

**Step 3: 做页面级验证**

Run: 本地浏览器验证教师端与演示模式学生端。

Expected: 可翻页、课堂码可见、等待超过 30 秒无 POST 风暴与资源耗尽报错。

### Task 4: 今日新特性回归

**Files:**
- Inspect/Run against today's touched areas under `src/app/(main)/profile/**`
- Inspect/Run against `src/app/admin/data-governance/page.tsx`
- Inspect/Run against `src/app/api/student/**`
- Inspect/Run against `src/app/api/admin/data-governance/status/route.ts`

**Step 1: 运行与今天提交相匹配的测试与关键页面检查**

Run:
- `npm run test`
- `npm run lint`
- 有针对性地运行数据治理相关测试/集成脚本

**Step 2: 记录结果并更新文档**

Modify:
- `docs/ProjectDescription.md`

Expected: 留下明确的修复与验收结论。
