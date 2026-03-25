# L-2c 逐页验证与修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use `interactive-lesson-implementation` for design-vs-implementation validation and `webapp-testing` for browser verification.

**Goal:** 基于 L-2c 设计文档、runtime 编排与现有实现，对入口页、教师页、学生页及其步骤内容做逐页验证，修复偏差并完成复验。

**Architecture:** 以 `course-content/authoring/lessons/legacy/L-2c` 和 `course-content/runtime/lessons/legacy/L-2c` 为设计与运行时来源，以 `src/lib/l2c-course.ts` 和 `src/features/interactive/l2c-frequency-bode/*` 为实现主体。先建立逐页核对清单，再通过浏览器自动化和针对性测试验证页面、课堂同步、知识卡片、讲义与媒体链路。

**Tech Stack:** Next.js 14, TypeScript, Prisma, Playwright, js_repl, course-content runtime pipeline.

### Task 1: 建立设计核对基线

**Files:**
- Read: `course-content/authoring/lessons/legacy/L-2c/design/interactive-page.md`
- Read: `course-content/authoring/lessons/legacy/L-2c/design/boppps.md`
- Read: `course-content/authoring/lessons/legacy/L-2c/design/handout.md`
- Read: `course-content/authoring/lessons/legacy/L-2c/design/multimedia.md`
- Read: `course-content/runtime/lessons/legacy/L-2c/lesson.json`
- Read: `course-content/runtime/lessons/legacy/L-2c/graph-overlay.json`
- Read: `.codex/skills/interactive-lesson-implementation/notes/L-2c.md`

**Steps:**
1. 提取 L-2c 的页面顺序、每页目标、媒体、互动形式、教师动作和学生动作。
2. 记录 runtime 的知识卡片、讲义和媒体资源映射。
3. 形成逐页核对清单，作为后续验证标准。

### Task 2: 检查实现结构与测试覆盖

**Files:**
- Read: `src/lib/l2c-course.ts`
- Read: `src/features/interactive/l2c-frequency-bode/entry-page.tsx`
- Read: `src/features/interactive/l2c-frequency-bode/course-header.tsx`
- Read: `src/features/interactive/l2c-frequency-bode/step-panels.tsx`
- Read: `src/features/interactive/l2c-frequency-bode/teacher-page.tsx`
- Read: `src/features/interactive/l2c-frequency-bode/student-page.tsx`
- Read: `scripts/tests/test-l2c-course-registration.ts`
- Read: `scripts/tests/test-l2c-entry-runtime-content.ts`
- Read: `scripts/tests/test-l2c-step-knowledge-drawer.ts`
- Read: `scripts/tests/test-l2c-runtime-export.ts`

**Steps:**
1. 对照设计清单，确认实现的步骤数、标题、媒体与互动组件挂载点。
2. 找出已有自动化测试覆盖的部分与缺口。
3. 标记需要浏览器实测或修复的风险点。

### Task 3: 页面级逐页验证

**Files:**
- Verify: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/page.tsx`
- Verify: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/[sessionId]/page.tsx`
- Verify: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]/page.tsx`

**Steps:**
1. 启动本地应用。
2. 访问 L-2c 入口页，验证 runtime 首页模块、知识网络、卡片预览、讲义入口和媒体链接。
3. 创建或进入课堂，逐步验证教师页与学生页在每个步骤上的标题、文案、知识卡片、AI 对话、课堂同步与互动反馈。
4. 记录所有偏差和复现方式。

### Task 4: 修复与补测

**Files:**
- Modify: 视验证结果而定
- Test: 视验证结果而定

**Steps:**
1. 对每个确认的偏差做最小修复。
2. 优先补充能稳定复现问题的自动化测试。
3. 对已修复问题做针对性复验。

### Task 5: 回归验证与文档更新

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/notes/L-2c.md`
- Modify: `docs/ProjectDescription.md`（若有用户可见行为变化）

**Steps:**
1. 运行相关测试与必要的浏览器复验。
2. 将设计核对结论、问题与修复结果写回 L-2c 课程笔记。
3. 汇总仍存风险或后续建议。
