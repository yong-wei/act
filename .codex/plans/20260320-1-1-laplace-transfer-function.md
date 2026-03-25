# 1-1 Laplace Transfer Function Implementation Plan

> **For Codex:** 按 TDD 先补测试，再实现 runtime、精品课页面、媒体与注册链路。

**Goal:** 为 `1-1` 一次性落地完整精品互动课，覆盖 runtime 导出、首页导学、教师端/学生端课堂页、14 个互动步骤、AI 上下文、课堂同步、教师统计反馈与互动课程入口注册。

**Architecture:** 以 `L-2c` 作为 runtime-first 首页与知识卡组织基线，以 `L-sum` 作为理论型精品课双端页面、AI 上下文、事件埋点与课堂同步基线，并按 `1-1` 设计稿新增媒体与步骤内容。运行时资源统一从 `course-content/runtime/lessons/legacy/1-1` 读取，课堂入口走预置教案克隆 + 课堂会话创建链路。

**Tech Stack:** Next.js 14、TypeScript、React Client Components、现有 session framework、`course-content/scripts/export_runtime.py`、`python3` 代码直出图脚本

### Task 1: 收拢 1-1 authoring 输入与课程笔记

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/notes/1-1.md`
- Create: `course-content/authoring/knowledge/cards/lessons/legacy/1-1/sequence.json`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/h-01-spring-mass-damper.py`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/h-02-laplace-transform-flow.py`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/h-03-pole-response-family.py`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/h-04-typical-elements.py`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/h-05-rc-circuit.py`
- Create: `course-content/authoring/lessons/legacy/1-1/media/raw/sh-01-mason-portrait.png`

**Step 1:** 记录 `interactive-page.md` / `boppps.md` / `handout.md` / `multimedia.md` 的 14 步结构、媒体清单、AI 融入点、教师控制流与当前缺口。

**Step 2:** 把 `sequence.json` 放到 runtime 导出脚本实际消费的位置，避免 `export_runtime.py` 因路径不一致失败。

**Step 3:** 准备代码直出图脚本和静态位图原件，让 authoring → runtime 导出链闭合。

### Task 2: 先写失败测试锁住 1-1 完整范围

**Files:**
- Create: `scripts/tests/test-1-1-runtime-export.ts`
- Create: `scripts/tests/test-1-1-course-registration.ts`
- Create: `scripts/tests/test-1-1-entry-runtime-content.ts`
- Create: `scripts/tests/test-1-1-session-framework-adoption.ts`
- Create: `scripts/tests/test-1-1-event-coverage.ts`
- Create: `scripts/tests/test-1-1-assessment-controls.ts`

**Step 1:** 写 runtime 导出测试，断言：
- `course-content/runtime/lessons/legacy/1-1/lesson.json`
- `course-content/runtime/lessons/legacy/1-1/graph-overlay.json`
- `course-content/runtime/lessons/legacy/1-1/handout.md`
- 6 项媒体落到 runtime 目录，讲义媒体路径改写到 `/course-runtime/...`

**Step 2:** 写课程注册测试，断言：
- `src/lib/unit-1-1-course.ts` 暴露路由段、标题、步骤配置与课程卡片
- `learning-catalog`、`preset-lessons`、`classroom-session-route` 完成注册
- `/interactive-learning/courses/<slug>` 与教师/学生路由存在

**Step 3:** 写首页内容测试，断言：
- 首页 route 加载 `loadLessonRuntimeEntry('1-1')`
- 入口区顺序是教师入口 / 自由浏览 / 学生入口
- runtime 知识网络、卡片预览、讲义入口与 PDF 导出接入

**Step 4:** 写会话与事件测试，断言：
- 学生/教师页都接入 `useStudentLessonSession`、`useTeacherLessonSession`、`useCourseEventTracking`
- 提交、重提、AI 打开、AI 提问、步骤浏览都走统一事件链
- 页面不直接拼 `tracking.emit(...)` 课程语义事件

**Step 5:** 写测验与反馈控制测试，断言：
- 选择题有教师统计与显示答案控制
- 文本题有词云、默认折叠回复列表与学生提交状态
- AI 协作页体现“先手算，再 AI 对照，再反思”
- 关键互动步骤存在提交区、等待态或反馈态

### Task 3: 让测试转绿并实现 1-1 课程骨架

**Files:**
- Create: `src/lib/unit-1-1-course.ts`
- Create: `src/lib/unit-1-1-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Create: `src/features/interactive/unit-1-1-laplace/course-header.tsx`
- Create: `src/features/interactive/unit-1-1-laplace/entry-page.tsx`
- Create: `src/features/interactive/unit-1-1-laplace/student-page.tsx`
- Create: `src/features/interactive/unit-1-1-laplace/teacher-page.tsx`
- Create: `src/features/interactive/unit-1-1-laplace/step-panels.tsx`
- Create: `src/features/interactive/unit-1-1-laplace/workspace.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/teacher/[sessionId]/page.tsx`
- Create: `src/features/teacher/preset-lessons/presets/unit-1-1-laplace-transfer-function.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1:** 建立 `1-1` 课程常量：
- 路由段、标题、副标题、课程描述、步骤清单、媒体映射、会话 adapter、教师/学生状态类型
- 14 个步骤覆盖展示、投票、填空、判断、AI 协作、拖拽/探索、匹配、综合例题

**Step 2:** 建立步骤级 AI 上下文：
- 覆盖导入、微分定理、三步法、AI 验证、零极点联动、典型环节、综合例题等关键页
- 在学生页步骤切换时用 `updatePageContext(...)` 更新全局 AI 框架

**Step 3:** 实现入口页：
- 复用 `LessonEntryRuntimeSections`
- 首页摘要明确承接 `L-sum` 到 `1-1`
- 接通预置教案克隆、课堂创建与课堂码加入

**Step 4:** 实现教师页与学生页：
- 复用统一课堂会话 hooks
- 支持教师推进步骤、释放活动、显示答案、结束课堂
- 学生端支持首次对齐、后续不同步提示、提交/重提状态与知识卡抽屉

### Task 4: 落地 14 步内容、工作区与反馈闭环

**Files:**
- Modify: `src/features/interactive/unit-1-1-laplace/step-panels.tsx`
- Modify: `src/features/interactive/unit-1-1-laplace/workspace.tsx`

**Step 1:** 实现步骤 01-03：
- 地图回顾、船舶航向情境引入、拉氏变换降维动机
- 教师步进展示与学生观察文案

**Step 2:** 实现步骤 04-09：
- 微分定理即时练习
- 传递函数定义与零初始条件辨析
- 船舶/RC 三步法演示
- AI 验证页的手算区 + 页内 AI 助手 + 反思提交
- 标准形式选择题

**Step 3:** 实现步骤 10-14：
- 极点-响应联动面板
- 零点定性作用演示
- 典型环节比例/积分匹配
- 惯性/振荡参数滑块面板
- 弹簧-质量-阻尼器综合例题与自动反馈

**Step 4:** 补齐反馈闭环：
- 选择题教师统计 / 学生提交态 / 正确答案揭示
- 文本题词云 / 折叠回复列表 / 重提覆盖
- AI 页防止学生把 AI 当第一步答案机

### Task 5: 出图、审核与 runtime 导出

**Files:**
- Modify: `course-content/scripts/export_runtime.py`（仅在 1-1 输入链仍不闭合时）
- Create or Modify: `course-content/authoring/lessons/legacy/1-1/media/processed/*.svg`
- Generate: `course-content/runtime/lessons/legacy/1-1/*`

**Step 1:** 用 `python3` 执行 5 个代码直出图脚本，先输出到 `course-content/authoring/lessons/legacy/1-1/media/processed/` 进行合理性审核。

**Step 2:** 通过审核后，执行 `bash course-content/scripts/export-runtime.sh 1-1`，生成 runtime lesson bundle 和媒体。

**Step 3:** 若导出链因 `1-1` 目录组织差异失败，再做最小必要脚本修正，不扩大全局导出逻辑。

### Task 6: 全量验证与文档收口

**Files:**
- Modify: `docs/ProjectDescription.md`
- Modify: `.codex/skills/interactive-lesson-implementation/notes/1-1.md`

**Step 1:** 运行定向测试：
- `npx --yes tsx scripts/tests/test-1-1-runtime-export.ts`
- `npx --yes tsx scripts/tests/test-1-1-course-registration.ts`
- `npx --yes tsx scripts/tests/test-1-1-entry-runtime-content.ts`
- `npx --yes tsx scripts/tests/test-1-1-session-framework-adoption.ts`
- `npx --yes tsx scripts/tests/test-1-1-event-coverage.ts`
- `npx --yes tsx scripts/tests/test-1-1-assessment-controls.ts`

**Step 2:** 运行仓库验证：
- `npm run lint`
- `npm run test`
- `npm run build`

**Step 3:** 更新课程笔记和项目文档，记录：
- 设计稿差异闭环
- 媒体清单与审核结论
- runtime 导出结果
- 测试/构建命令与结果
