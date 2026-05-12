# L-sum Design Feasible Domain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 打通 `L-sum` 从 `course-content/authoring` 到 `course-content/runtime` 以及精品互动课程入口、教师页、学生页的完整链路。

**Architecture:** 复用 `L-2c` 已验证的理论课精品课壳层、runtime 首页模块、讲义/PDF 链路、页内 AI 与知识卡抽屉能力；`L-sum` 在此基础上新增 15 步课程配置、设计可行域专属媒体映射与教师端统计/揭示控制。运行时资源统一通过 `course-content/scripts/export-runtime.sh L-sum` 生成，不直接从 authoring 读取。

**Tech Stack:** Next.js 14, TypeScript, React, Tailwind/shadcn, Node tests, Python3 runtime export scripts, Playwright browser validation.

### Task 1: 固化 L-sum runtime 导出基线

**Files:**
- Create: `scripts/tests/test-lsum-runtime-export.ts`
- Modify: `course-content/authoring/lessons/legacy/L-sum/media/raw/*.py`
- Create: `course-content/authoring/lessons/legacy/L-sum/media/raw/cd-01-feasible-domain-overview.py`
- Create: `course-content/authoring/lessons/legacy/L-sum/media/raw/matplotlib_font.py`
- Modify: `course-content/authoring/knowledge/cards/nodes/*Lsum*.md`

**Step 1: Write the failing test**

断言：
- `course-content/runtime/lessons/legacy/L-sum/{lesson.json,graph-overlay.json,handout.md}` 存在
- 10 个 runtime 媒体文件存在
- handout 中媒体路径已改写到 `/course-runtime/lessons/legacy/L-sum/media/*`

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-lsum-runtime-export.ts`

Expected: 因 runtime lesson bundle 与缺失媒体未生成而失败。

**Step 3: Write minimal implementation**

最小实现包括：
- 为 L-sum 绘图脚本统一补 `--output`
- 新增缺失的 `cd-01-feasible-domain-overview.svg` 生成脚本
- 接入 CJK 字体 helper，减少中文媒体缺字
- 更新知识卡图片路径到 runtime 绝对路径

**Step 4: Run test to verify it passes**

Run:
- `bash course-content/scripts/export-runtime.sh L-sum`
- `node scripts/tests/test-lsum-runtime-export.ts`

Expected: PASS

### Task 2: 落地 L-sum 课程注册与入口页

**Files:**
- Create: `src/lib/lsum-course.ts`
- Create: `src/app/interactive-learning/courses/lsum-design-feasible-domain/page.tsx`
- Create: `src/app/interactive-learning/courses/lsum-design-feasible-domain/teacher/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/lsum-design-feasible-domain/student/[sessionId]/page.tsx`
- Create: `src/features/interactive/lsum-design-feasible-domain/*`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Create: `src/features/teacher/preset-lessons/presets/lsum-design-feasible-domain.ts`

**Step 1: Write the failing test**

Create `scripts/tests/test-lsum-course-registration.ts`，断言：
- `L-sum` 固定 route segment 已注册
- 课程目录已挂接 `L-sum`
- preset 已注册
- 课堂码路由已能解析到 `L-sum`

**Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-lsum-course-registration.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

复用 `L-2c` 骨架，建立：
- 课程标题、说明、路由段、preset key
- 首页三入口 + runtime 导学
- 教师/学生双端入口路由

**Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-lsum-course-registration.ts`

Expected: PASS

### Task 3: 接入 15 步课堂配置与互动能力

**Files:**
- Create/Modify: `src/features/interactive/lsum-design-feasible-domain/entry-page.tsx`
- Create/Modify: `src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx`
- Create/Modify: `src/features/interactive/lsum-design-feasible-domain/student-page.tsx`
- Create/Modify: `src/features/interactive/lsum-design-feasible-domain/step-panels.tsx`
- Create/Modify: `src/lib/lsum-course.ts`

**Step 1: Write the failing tests**

Create:
- `scripts/tests/test-lsum-entry-runtime-content.ts`
- `scripts/tests/test-lsum-step-knowledge-drawer.ts`
- `scripts/tests/test-lsum-assessment-controls.ts`

断言：
- 首页使用 `loadLessonRuntimeEntry('L-sum')`
- 首页包含知识点网络、知识卡片预览、讲义入口与 PDF 导出按钮
- 存在前测/后测统计与答案揭示控制
- 文本型步骤在教师端提供词云与默认折叠回复列表
- 有知识卡的页面在顶部标题右上角显示“知识卡片”抽屉入口

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test-lsum-entry-runtime-content.ts`
- `node scripts/tests/test-lsum-step-knowledge-drawer.ts`
- `node scripts/tests/test-lsum-assessment-controls.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

最小实现覆盖：
- 15 步配置与媒体映射
- 前测/后测题目、自由文本记录、AI 对话弹窗
- 教师端统计/答案揭示/词云
- 学生端首次对齐与不同步跳转提示

**Step 4: Run tests to verify they pass**

Run:
- `node scripts/tests/test-lsum-entry-runtime-content.ts`
- `node scripts/tests/test-lsum-step-knowledge-drawer.ts`
- `node scripts/tests/test-lsum-assessment-controls.ts`

Expected: PASS

**2026-03-15 进度备注**
- 已完成最小正式课堂框架：
  - 新增 `src/features/interactive/lsum-design-feasible-domain/course-header.tsx`
  - 新增 `src/features/interactive/lsum-design-feasible-domain/step-panels.tsx`
  - 教师/学生页已接入 `StepKnowledgeDrawer`
  - 教师页已包含“当前在线学生”“结束课堂”“释放前测”“释放后测”“显示答案”“词云”“学生回复列表”“教师端汇总”
  - 学生页已接入 `LSUMStudentActivityForm`、summary 页个人回收单与 step-10 页内 AI 助手
- 已通过：
  - `node scripts/tests/test-lsum-step-knowledge-drawer.ts`
  - `node scripts/tests/test-lsum-assessment-controls.ts`
- 已继续推进为真实课堂同步：
  - 教师页已接入 `/api/session` 读取、步骤 PATCH、`teacher:course-sync` 广播、结束课堂回写
  - 学生页已接入 `useSession`、`student:lsum:state` 持久化、首次对齐与不同步提示
  - 课程总入口已修复 `L-sum` 精品课过滤链路，并补了 `tests/lsum-premium-course.spec.ts`
- 本轮新增通过：
  - `node scripts/tests/test-lsum-teacher-session-sync.ts`
  - `node scripts/tests/test-lsum-student-session-sync.ts`
  - `npx playwright test tests/lsum-premium-course.spec.ts`

### Task 4: 浏览器闭环与文档更新

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/notes/L-sum.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: Verification**

Run:
- `bash course-content/scripts/export-runtime.sh L-sum`
- `node scripts/tests/test-lsum-runtime-export.ts`
- `node scripts/tests/test-lsum-course-registration.ts`
- `node scripts/tests/test-lsum-entry-runtime-content.ts`
- `node scripts/tests/test-lsum-step-knowledge-drawer.ts`
- `node scripts/tests/test-lsum-assessment-controls.ts`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:integration`

**Step 2: Update notes/docs**

记录：
- 设计稿与实现稿差异
- 媒体资源状态
- 浏览器闭环结论
- 仍需补齐的页面交互与风险

**Step 3: Commit**

```bash
git add course-content src scripts/tests docs .codex/skills/interactive-lesson-implementation/notes/L-sum.md
git commit -m "feat: add L-sum design feasible domain runtime baseline"
```
