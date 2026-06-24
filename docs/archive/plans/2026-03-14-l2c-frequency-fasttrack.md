# L-2c Frequency Fast Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 打通 L-2c 从 `course-content/authoring` 到 `course-content/runtime` 的资源链路，并落地一门可访问的精品互动课程首页、教师页与学生页。

**Architecture:** 复用 L-2b 已验证的精品课壳层、runtime 首页模块、讲义/PDF 导出和步骤知识卡抽屉能力；L-2c 仅新增课程专属配置与步骤内容。运行时资源统一由 `course-content/scripts/export-runtime.sh L-2c` 生成，不直接读取 `authoring`。

**Tech Stack:** Next.js 14, TypeScript, React, Tailwind/shadcn, Node tests, Python3 runtime export scripts.

### Task 1: 先补 L-2c runtime 导出测试

**Files:**
- Create: `scripts/tests/test-l2c-runtime-export.ts`

**Step 1: Write the failing test**

断言：
- `course-content/runtime/lessons/legacy/L-2c/lesson.json` 存在
- `course-content/runtime/lessons/legacy/L-2c/graph-overlay.json` 存在
- `course-content/runtime/lessons/legacy/L-2c/handout.md` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/h-01-bode-magnitude-regions.svg` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/h-02-phase-margin-diagram.svg` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/h-03-bode-example-annotated.svg` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/sh-04-phase-margin-vs-overshoot.svg` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/sh-05-three-domain-coupling.svg` 存在
- `course-content/runtime/lessons/legacy/L-2c/media/sh-00-equalizer-analogy.png` 存在
- handout 中媒体路径已改写为 `/course-runtime/lessons/legacy/L-2c/media/*`

**Step 2: Run test to verify it fails**

Run: `npx --yes tsx scripts/tests/test-l2c-runtime-export.ts`

Expected: 因 L-2c runtime 产物缺失或媒体未复制而失败。

**Step 3: Write minimal implementation**

修改 `course-content/scripts/export_runtime.py`：
- 让 L-2c 运行时导出可覆盖非脚本媒体复制
- 生成 lesson bundle、graph overlay、handout 与 runtime media
- 如需补齐 step-to-card 编排，在 authoring/sequence 或 runtime 生成阶段完成最小映射

**Step 4: Run test to verify it passes**

Run:
- `bash course-content/scripts/export-runtime.sh L-2c`
- `npx --yes tsx scripts/tests/test-l2c-runtime-export.ts`

Expected: PASS

### Task 2: 落地 L-2c 课程注册与入口页

**Files:**
- Create: `src/lib/l2c-course.ts`
- Create: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/page.tsx`
- Create: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/[sessionId]/page.tsx`
- Create: `src/features/interactive/l2c-frequency-bode/*`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Create: `src/features/teacher/preset-lessons/presets/l2c-frequency-bode-fasttrack.ts`

**Step 1: Write the failing test**

Create `scripts/tests/test-l2c-course-registration.ts`，断言：
- L-2c 导出固定 route segment
- 课程目录已挂接 L-2c
- preset 已注册
- 课堂码路由已能解析到 L-2c

**Step 2: Run test to verify it fails**

Run: `npx --yes tsx scripts/tests/test-l2c-course-registration.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

复用 L-2b 骨架，建立 L-2c 课程配置、三条路由与注册点。

**Step 4: Run test to verify it passes**

Run: `npx --yes tsx scripts/tests/test-l2c-course-registration.ts`

Expected: PASS

### Task 3: 接入首页 runtime 模块与课堂页知识卡

**Files:**
- Create/Modify: `src/features/interactive/l2c-frequency-bode/entry-page.tsx`
- Create/Modify: `src/features/interactive/l2c-frequency-bode/teacher-page.tsx`
- Create/Modify: `src/features/interactive/l2c-frequency-bode/student-page.tsx`
- Create/Modify: `src/features/interactive/l2c-frequency-bode/step-panels.tsx`
- 可选提炼共享层：`src/features/interactive/shared/*`

**Step 1: Write the failing tests**

Create:
- `scripts/tests/test-l2c-entry-runtime-content.ts`
- `scripts/tests/test-l2c-step-knowledge-drawer.ts`

断言：
- 首页使用 `loadLessonRuntimeEntry('L-2c')`
- 首页包含知识点网络、知识卡片预览、讲义入口与 PDF 导出按钮
- 教师页与学生页在存在知识卡时显示“知识卡片”抽屉入口
- 抽屉入口位于顶部标题模块右上角

**Step 2: Run tests to verify they fail**

Run:
- `npx --yes tsx scripts/tests/test-l2c-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-l2c-step-knowledge-drawer.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

复用 L-2b 的 runtime 首页模块、讲义/PDF 链路、步骤知识卡抽屉，填充 L-2c 的 17 步配置与本地记录/测验/AI 页内对话。

**Step 4: Run tests to verify they pass**

Run:
- `npx --yes tsx scripts/tests/test-l2c-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-l2c-step-knowledge-drawer.ts`

Expected: PASS

### Task 4: 完整验证与文档更新

**Files:**
- Create: `.agents/skills/interactive-lesson-implementation/notes/L-2c.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: Verification**

Run:
- `bash course-content/scripts/export-runtime.sh L-2c`
- `npx --yes tsx scripts/tests/test-l2c-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-l2c-course-registration.ts`
- `npx --yes tsx scripts/tests/test-l2c-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-l2c-step-knowledge-drawer.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

**Step 2: Update notes/docs**

记录：
- L-2c 当前实现范围
- 设计稿差异
- 资源状态
- 验证结果

**Step 3: Commit**

```bash
git add course-content src scripts/tests docs .agents/skills/interactive-lesson-implementation/notes/L-2c.md
git commit -m "feat: add L-2c frequency fast track lesson"
```
