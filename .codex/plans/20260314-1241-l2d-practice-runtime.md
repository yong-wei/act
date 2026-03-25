# L-2d Practice Runtime Implementation Plan

> **For Codex:** 按 TDD 先补测试，再实现运行时导出、课程配置与双端页面。

**Goal:** 为 `L-2d` 落地一套仅依赖 `course-content/runtime` 即可运行的实践型互动课程，首页讲义改读 `practice-guide.md`，课堂评分与反馈按 `assessment-spec.md` 执行。

**Architecture:** 复用 `L-2c` 的 runtime 首页模块与 `L-2b` 的实践课交互模式。运行时资源由 `export_runtime.py` 导出 `lesson.json / graph-overlay.json / handout.md`，课程代码新增 `src/lib/l2d-course.ts` 与 `src/features/interactive/l2d-three-domain-linkage/*`，三面板工作区直接复用 `linkage-engine` 的纯计算函数在前端计算根轨迹、时域和频域指标。

**Tech Stack:** Next.js 14、TypeScript、React Client Components、Tailwind 语义主题类、现有课堂会话 API、`course-content/scripts/export_runtime.py`

### Task 1: 记录设计差异与运行时约束

**Files:**
- Create: `.codex/skills/interactive-lesson-implementation/notes/L-2d.md`

**Step 1:** 记录 `interactive-page.md`、`practice-guide.md`、`assessment-spec.md` 中的步骤、评分逻辑、runtime 约束与媒体结论

**Step 2:** 记录与现有实现的关键差异：
- 首页讲义源改为 `practice-guide.md`
- 资源全部由 runtime 支撑
- 三面板工作区为前端绘制，不额外依赖静态媒体

### Task 2: 先写失败测试

**Files:**
- Create: `scripts/tests/test-l2d-runtime-export.ts`
- Create: `scripts/tests/test-l2d-course-registration.ts`
- Create: `scripts/tests/test-l2d-entry-runtime-content.ts`
- Create: `scripts/tests/test-l2d-workspace-and-assessment.ts`

**Step 1:** 写运行时导出测试，断言：
- `course-content/runtime/lessons/legacy/L-2d/lesson.json`
- `course-content/runtime/lessons/legacy/L-2d/graph-overlay.json`
- `course-content/runtime/lessons/legacy/L-2d/handout.md`
- 讲义内容来自 `practice-guide.md`

**Step 2:** 写课程注册测试，断言：
- `src/lib/l2d-course.ts` 暴露固定路由段、标题、步骤配置
- `learning-catalog`、`preset-lessons`、`classroom-session-route` 完成注册

**Step 3:** 写首页内容测试，断言：
- 首页路由加载 runtime lesson bundle
- 入口卡片位于 runtime 导学区之前
- 共享 runtime 导学区被接入

**Step 4:** 写课堂功能测试，断言：
- 学生/教师页接入步骤知识卡抽屉
- `assessment-spec` 里的任务一、任务二、任务三评分文字与工作区提示在页面中落地
- 三面板工作区组件存在且对 `K_cr = 42`、`K` 范围、三域指标文案有显式配置

### Task 3: 让测试转绿

**Files:**
- Modify: `course-content/scripts/export_runtime.py`
- Create: `src/lib/l2d-course.ts`
- Create: `src/features/interactive/l2d-three-domain-linkage/course-header.tsx`
- Create: `src/features/interactive/l2d-three-domain-linkage/entry-page.tsx`
- Create: `src/features/interactive/l2d-three-domain-linkage/student-page.tsx`
- Create: `src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx`
- Create: `src/features/interactive/l2d-three-domain-linkage/step-panels.tsx`
- Create: `src/features/interactive/l2d-three-domain-linkage/workspace.tsx`
- Create: `src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/page.tsx`
- Create: `src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/teacher/[sessionId]/page.tsx`
- Create: `src/features/teacher/preset-lessons/presets/l2d-three-domain-linkage-practice.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1:** 调整 runtime 导出逻辑：
- `handout.md` 不存在时自动回退到 `practice-guide.md`
- 保持媒体路径重写规则不变

**Step 2:** 实现 `L-2d` 课程配置：
- 14 个步骤配置
- 任务一/二/三的数据结构与教师摘要逻辑
- 课程卡片、预设课和会话路由注册

**Step 3:** 实现首页：
- 复用 `LessonEntryRuntimeSections`
- 顶部按“教师入口 / 自由浏览 / 学生入口”排序
- 首页摘要强调实践课与 runtime 讲义

**Step 4:** 实现三面板工作区：
- 固定开环极点 `0/-1/-6`
- `K` 范围 `[0.01, 80]`
- 展示闭环极点、阶跃响应、Bode 幅相图
- 支持滑块与根轨迹选点双向联动
- 输出 `sigma / omega / Mp / ts / gamma / stability` 指标，供任务评分使用

**Step 5:** 实现学生页与教师页：
- 复用双端同步、首次对齐与不同步提示
- 顶部右上角接入知识卡抽屉
- 教师端显示任务进度、分布、词云/列表与结束课堂入口
- 学生端支持前测、任务一提交、任务二四行记录、任务三反思、后测区间输入

### Task 4: 导出、验证、文档收口

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `.codex/skills/interactive-lesson-implementation/notes/L-2d.md`

**Step 1:** 运行 `bash course-content/scripts/export-runtime.sh L-2d`

**Step 2:** 运行定向测试：
- `npx --yes tsx scripts/tests/test-l2d-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-l2d-course-registration.ts`
- `npx --yes tsx scripts/tests/test-l2d-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-l2d-workspace-and-assessment.ts`

**Step 3:** 运行仓库验证：
- `npm run lint`
- `npm run build`

**Step 4:** 更新课程笔记与项目文档，记录：
- 设计差异闭环
- runtime 资源结论
- 验证命令与结果
