# PR Review Followups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 核验 PR #1 的 5 条 Codex review 评论，并仅对属实问题做最小修复与验证。

**Architecture:** 先对 Docker 镜像、教师端路由、调度器日期计算、治理风险标记生命周期做源码核验，再按最小变更原则修复。对于手册/部署类问题，如果已有外部前提或并非当前镜像路径生效，则在 PR 线程给出技术性反驳，不盲改。

**Tech Stack:** GitHub PR review、Dockerfile、Next.js、TypeScript、Prisma、BullMQ、GitHub CLI

### Task 1: 核验评论

**Files:**
- Inspect: `Dockerfile`
- Inspect: `src/lib/course-runtime.ts`
- Inspect: `src/app/course-runtime/[...assetPath]/route.ts`
- Inspect: `src/lib/handout-pdf-export.ts`
- Inspect: `src/features/teacher/teacher-insights.ts`
- Inspect: `src/app/teacher/classes/[classId]/analytics/page.tsx`
- Inspect: `scripts/workers/scheduler.ts`
- Inspect: `scripts/workers/data-governance-worker.ts`

**Step 1:** 用源码确认每条评论是否与当前代码一致
**Step 2:** 标出“属实 / 部分属实 / 不属实”及根因

### Task 2: 修复属实问题

**Files:**
- Modify: `Dockerfile`
- Modify: `src/features/teacher/teacher-insights.ts`
- Modify: `scripts/workers/scheduler.ts`
- Modify: `scripts/workers/data-governance-worker.ts`
- Test: 视需要补充或更新现有测试

**Step 1:** 先修阻断性 P1
**Step 2:** 再修 P2
**Step 3:** 对不改代码的评论准备技术回复

### Task 3: 验证并回写 PR

**Files:**
- Possibly modify: PR review threads only

**Step 1:** 跑 `npm run lint`
**Step 2:** 跑 `npm run test`
**Step 3:** 跑 `npm run build`
**Step 4:** `git commit` + `git push`
**Step 5:** 在 PR 线程逐条回复并标记已解决 / 说明反驳依据
