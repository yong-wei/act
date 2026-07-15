# Unit 1-3 Parameter Pole Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单元 1-3“参数变化与极点迁移”制作成 11 步 manifest-first 精品互动课程，完整接入 runtime、教师/学生课堂、知识卡片、AI 上下文、原生控制图示和课程入口。

**Architecture:** 以 `course-content/authoring/lessons/1-3/design/1-3-interactive-page.md` 为内容真源，在作者态补齐机读互动契约，经现有导出器生成 runtime manifest。页面层复用 `1-2` 的 manifest runtime、课堂同步和提交闭环，原生方框图与控制曲线只通过共享 `visual.blockDiagram` / `compute.panel` 能力呈现，不创建课程私有渲染器。

**Tech Stack:** Next.js 16、React、TypeScript、Vitest、Python 课程导出脚本、共享 manifest runtime、Rust/WASM control workbench。

## Global Constraints

- 正式课程身份为 `1-3：参数变化与极点迁移`，路由为 `unit-1-3-parameter-pole-migration`。
- `course-content/runtime` 是页面唯一内容来源；不得从页面回读 authoring。
- 11 个步骤的标题、顺序和教学证据链与现有 1-3 互动设计保持一致。
- 技术图示原生绘制或计算；现有 PNG 只作为共享能力不可用时的后备证据。
- 学生响应统一进入 `useManifestSubmissionController`，不得直接发送旧式 submit 事件。
- 不新增模块 kind，不在单课目录创建共享视觉能力的平行实现。
- 不使用硬编码十六进制色、`dark:` 或旧式固定色 Tailwind 类。
- 未经用户明确要求不提交或推送。

---

### Task 1: 作者态互动契约与 runtime 生成

**Files:**
- Create: `course-content/authoring/lessons/1-3/design/1-3-interactive-contract.yaml`
- Create: `course-content/authoring/lessons/1-3/design/1-3-interactive-design-acceptance.json`
- Modify: `course-content/runtime/lessons/1-3/interactive-manifest.json`（由导出器生成）
- Modify: `course-content/runtime/lessons/1-3/lesson.json`（由导出器生成）
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Interfaces:**
- Consumes: 1-3 互动设计、讲义、BOPPPS、现有标准模块 taxonomy。
- Produces: `InteractiveRuntimeManifest`，包含 11 个步骤以及 `visual.blockDiagram`、`compute.panel`、活动和教师控制契约。

- [ ] **Step 1: 写失败测试，要求 runtime manifest 具有 11 步和新路由**

```ts
expect(manifest.courseRouteSegment).toBe('unit-1-3-parameter-pole-migration');
expect(manifest.steps.map((step) => step.id)).toEqual(
  Array.from({ length: 11 }, (_, index) => `step-${String(index + 1).padStart(2, '0')}`),
);
expect(manifest.steps.find((step) => step.id === 'step-04')?.modules.map((module) => module.kind))
  .toContain('visual.blockDiagram');
expect(manifest.steps.find((step) => step.id === 'step-06')?.modules.map((module) => module.kind))
  .toContain('compute.panel');
```

- [ ] **Step 2: 运行测试并确认因 1-3 manifest 仍为空步骤占位而失败**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts`
Expected: FAIL，11 步断言不满足。

- [ ] **Step 3: 编写 11 步机读契约**

契约必须逐步提供 `layout`、`modules`、`content_blocks`、`interaction_spec`、`teacher_controls`、`telemetry_spec`、`teacher_insight_spec`、`ai_context_spec`、`preview_contract` 和 `acceptance_checks`。步骤 4 使用 `visual.blockDiagram`；步骤 6 使用 `compute.panel` + `control-linked-comparison`；步骤 7 使用 `compute.panel` + `control-root-locus-design-map`。

- [ ] **Step 4: 写入设计接受文件并执行导出与 manifest 审计**

Run: `rtk python3 course-content/scripts/export_runtime.py 1-3`
Run: `rtk python3 .agents/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson 1-3`
Expected: 导出成功，标准模块、content/activity 分流和 payload 非空检查通过。

- [ ] **Step 5: 运行标准组件闸门**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/interactive-module-taxonomy.test.ts src/features/interactive/__tests__/interactive-module-registry-gate.test.ts`
Expected: PASS。

### Task 2: 课程定义、AI 上下文与平台注册

**Files:**
- Create: `src/lib/unit-1-3-course.ts`
- Create: `src/lib/unit-1-3-ai-contexts.ts`
- Create: `src/features/teacher/preset-lessons/presets/unit-1-3-parameter-pole-migration.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/teacher/preset-lessons/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/lib/interactive-lesson-identity.ts`
- Modify: `src/features/interactive/course-submission-gate-inventory.ts`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`
- Test: `src/features/interactive/__tests__/learning-catalog.test.ts`

**Interfaces:**
- Produces: `UNIT_1_3_LESSON_STEPS`、`UNIT_1_3_SESSION_ADAPTER`、课程卡片、预置教案和每步 AI context。

- [ ] **Step 1: 扩展失败测试覆盖课程身份、注册、预置课、AI 和 route identity**

```ts
expect(UNIT_1_3_LESSON_STEPS).toHaveLength(11);
expect(FEATURED_LESSONS.map((lesson) => lesson.id)).toContain(UNIT_1_3_RESOURCE_KEY);
expect(ALL_PRESETS.some((preset) => preset.key === UNIT_1_3_PRESET_KEY)).toBe(true);
expect(COURSE_AI_CONTEXT_REGISTRY[UNIT_1_3_PRESET_KEY]).toBeDefined();
expect(resolveSessionRouteFromPlanTitle(UNIT_1_3_COURSE_TITLE).routeSegment)
  .toBe(UNIT_1_3_ROUTE_SEGMENT);
```

- [ ] **Step 2: 运行测试并确认缺少导出符号和注册而失败**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`
Expected: FAIL，1-3 正式课程尚未注册。

- [ ] **Step 3: 按 1-2 manifest-first 模式实现课程定义与 11 步 AI 上下文**

课程状态使用 `unit13_student_state`，教师同步状态使用 `teacher_sync_unit13`；每步 AI 上下文从步骤目标生成，但快捷问题和系统扩展只围绕开闭环增益、极点迁移、时域联读和根轨迹雏形。

- [ ] **Step 4: 注册课程目录、模块 1、预置课、AI registry、会话路由和提交门禁**

模块 1 顺序为 1-1、1-2、1-3；删除测试中旧 `unit-1-3-time-domain-response` 身份期待。

- [ ] **Step 5: 运行注册测试至通过**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`
Expected: PASS。

### Task 3: 入口页与课堂路由

**Files:**
- Create: `src/features/interactive/unit-1-3-parameter-pole-migration/entry-page.tsx`
- Create: `src/features/interactive/unit-1-3-parameter-pole-migration/course-header.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-3-parameter-pole-migration/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-3-parameter-pole-migration/teacher/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-3-parameter-pole-migration/teacher/[sessionId]/waiting/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-3-parameter-pole-migration/student/[sessionId]/page.tsx`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Interfaces:**
- Consumes: `loadLessonRuntimeEntry('1-3')`、`CourseEntryShell`、统一课堂 session access。
- Produces: 入口、教师、学生和等待路由。

- [ ] **Step 1: 写失败测试验证四类路由文件存在并加载课次 1-3**
- [ ] **Step 2: 运行测试确认路由缺失**
- [ ] **Step 3: 复用 `CourseEntryShell` 建立 runtime-first 入口页**
- [ ] **Step 4: 建立教师、学生、等待路由，复用 inactive-session 重定向**
- [ ] **Step 5: 运行路由与入口 runtime 测试**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts src/features/interactive/__tests__/lesson-entry-runtime-sections.test.ts src/features/interactive/__tests__/lesson-entry-knowledge-map.test.ts`
Expected: PASS。

### Task 4: Manifest 页面、课堂同步与共享提交

**Files:**
- Create: `src/features/interactive/unit-1-3-parameter-pole-migration/step-panels.tsx`
- Create: `src/features/interactive/unit-1-3-parameter-pole-migration/student-page.tsx`
- Create: `src/features/interactive/unit-1-3-parameter-pole-migration/teacher-page.tsx`
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`

**Interfaces:**
- Consumes: `renderInteractiveManifestStep`、content/activity registries、`useStudentLessonSession`、`useTeacherLessonSession`、`useManifestSubmissionController`。
- Produces: 11 步教师/学生双端、释放/显影/答案揭示、统计和结束课堂闭环。

- [ ] **Step 1: 写失败测试渲染步骤 4、6、7，并验证响应步骤进入 canonical submission inventory**
- [ ] **Step 2: 运行测试确认页面组件缺失**
- [ ] **Step 3: 实现只负责装配共享 renderer 的 `step-panels.tsx`**
- [ ] **Step 4: 实现学生页的跟页提示、知识卡片、AI context、状态保存和 canonical submission**
- [ ] **Step 5: 实现教师页的课堂码、在线学生折叠、活动释放、显影、答案揭示、统计与结束课堂**
- [ ] **Step 6: 运行课次测试与提交门禁**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts src/features/interactive/__tests__/manifest-submission-telemetry.test.ts`
Run: `rtk npm run test:course-data-quality-gates`
Expected: PASS。

### Task 5: 课程审查、设计闭环与实现笔记

**Files:**
- Replace: `.agents/skills/interactive-lesson/notes/1-3.md`
- Create: `course-content/authoring/lessons/1-3/notes/interactive-implementation-acceptance.json`
- Modify: `course-content/runtime/lessons/1-3/review/*`（审查脚本生成）

- [ ] **Step 1: 运行严格作者态审查并修复所有 1-3 阻塞项**

Run: `rtk python3 course-content/scripts/review_lesson_content.py --lesson 1-3 --strict-implementation-contract`
Expected: 无 blocking issues。

- [ ] **Step 2: 逐步核对设计稿与实现，记录 11 步、媒体、知识卡、教师控制和学生提交状态**
- [ ] **Step 3: 用真实 1-3 路径重写错误指向 2-2 的课程笔记**
- [ ] **Step 4: 写入实现接受文件，未完成浏览器证据不得标记 pass**

### Task 6: 最终验证与浏览器验收

**Files:**
- Test: `src/features/interactive/__tests__/unit-1-3-course.test.ts`
- Test: `course-content/runtime/lessons/1-3/review/interactive-manifest-audit.json`

- [ ] **Step 1: 运行课次、taxonomy、catalog、route 与数据质量测试**

Run: `rtk npm run test:unit -- src/features/interactive/__tests__/unit-1-3-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts src/features/interactive/__tests__/interactive-module-taxonomy.test.ts src/features/interactive/__tests__/interactive-module-registry-gate.test.ts`
Run: `rtk npm run test:course-data-quality-gates`
Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run: `rtk npm run typecheck`
Expected: 0 TypeScript errors。

- [ ] **Step 3: 启动平台并验收入口页、学生 demo 与教师 demo**

Run: `rtk npm run startup`
Expected: 新课程入口可访问，11 步可翻页，步骤 4/6/7 原生图示可操作，知识卡片与页内 AI 正常。

- [ ] **Step 4: 验收浅色、深色、桌面和移动端，并保存实现接受证据**
- [ ] **Step 5: 对最终 diff 做一次自审；因本任务未授权子代理，不派发独立子代理审查**

