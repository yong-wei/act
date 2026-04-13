# 2-2 Entry Page Runtime Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐 `2-2` 课程入口页 runtime-first 资源契约与课堂外知识卡埋点，并把复检结果固化到测试和 notes。

**Architecture:** 以 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections` 为共享入口基线，不重做 `2-2` 入口结构；通过扩展知识卡组件的可选追踪上下文，让入口页知识区在“节点聚焦”和“详情展开”两类行为上都落到统一的 `lesson_entry` 语义，同时补充 `2-2` 定向契约测试与作者态 notes 对照记录。

**Tech Stack:** Next.js 14, TypeScript, React, Vitest, Markdown notes

### Task 1: 写入口页埋点契约失败测试

**Files:**
- Modify: `src/features/interactive/__tests__/unit-2-2-course.test.ts`

**Step 1: 写失败测试**

- 为 `2-2` 增加入口页契约测试，至少覆盖：
  - 入口页继续复用 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`
  - 共享知识区使用 `lesson_entry` 作为入口页 surface
  - 知识卡详情展开具备 `knowledge_card_open` 链路

**Step 2: 运行测试验证失败**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-2-course.test.ts`

Expected: 新增的入口页知识埋点断言失败。

### Task 2: 最小实现入口页知识区埋点修复

**Files:**
- Modify: `src/features/interactive/shared/lesson-entry-runtime-sections.tsx`
- Modify: `src/features/knowledge/knowledge-card.tsx`

**Step 1: 让入口页知识区统一到 lesson_entry 语义**

- 调整 `LessonEntryRuntimeSections` 的课堂外追踪基线，使知识区行为归属入口页 surface。
- 为入口页内知识卡传入显式追踪上下文。

**Step 2: 让知识卡详情展开触发 `knowledge_card_open`**

- 在 `KnowledgeCard` 的概览/详情切换链路上增加可选详情展开回调或追踪上下文。
- 保持其他场景兼容，不破坏现有 `KnowledgeCardDialog` 和课堂内知识卡用法。

**Step 3: 跑定向测试验证通过**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-2-course.test.ts`

Expected: 新增入口页契约测试通过。

### Task 3: 补作者态对照表与复检记录

**Files:**
- Modify: `course-content/authoring/lessons/2-2/notes/2-2.md`

**Step 1: 追加入口页资源/埋点对照节**

- 记录 runtime 媒体来源、共享组件复用、课堂外事件覆盖和本轮证据。

**Step 2: 复检说明**

- 标出本轮只修实现层与 notes，不回写双轨设计正文。

### Task 4: 运行最终验证

**Files:**
- Modify: none

**Step 1: 跑最小相关验证**

Run:
- `npx vitest run src/features/interactive/__tests__/unit-2-2-course.test.ts`
- `npx vitest run src/features/interactive/__tests__/unit-2-1-entry-media.test.ts`

Expected: 与入口页 runtime-first / 课堂外资源埋点相关测试全部通过。

**Step 2: 如改动范围允许，再补 lint**

Run: `npm run lint -- --file src/features/interactive/shared/lesson-entry-runtime-sections.tsx --file src/features/knowledge/knowledge-card.tsx`

Expected: 目标文件无新增 lint 问题。
