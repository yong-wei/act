# L-2a 精品互动课堂重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按 `notes/lessons/L-2a/interactive-page.md` 实现 L-2a「三张面孔，同一系统——时域直觉速通」精品互动课堂，并重组互动课程入口，将新重构课程放入精品课程区，旧 `lessonXX` 系列收纳到默认折叠的下拉菜单中。

**Architecture:** 复用现有“柔性之海”精品课堂的 `entry -> teacher/student -> session/state` 路由与同步机制，在同级目录新增 L-2a 专用课程模块；左侧常驻工作区采用新的双面板组件，但优先复用 `lesson-07` 的二阶系统仿真与现有 `useInteractiveTracking` 埋点服务；右侧教师端/学生端按 18 步配置渲染，避免新增后端接口。

**Tech Stack:** Next.js 14、TypeScript、Tailwind CSS、NextAuth、现有 `/api/session` 与 `/api/session/[id]/state`、`useInteractiveTracking`

### Task 1: 目录入口重组

**Files:**
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/app/interactive-learning/courses/page.tsx`
- Test: `scripts/tests/test-interactive-courses-page.ts`

**Step 1: 写失败测试**

验证课程页包含：
- 精品课程中新增 L-2a 重构课入口
- 原 `lessonXX` 系列在默认折叠的下拉/折叠区
- 旧“柔性之海”仍保留在精品课程区

**Step 2: 运行测试确认失败**

Run: `npx --yes tsx scripts/tests/test-interactive-courses-page.ts`

**Step 3: 实现最小改动**

- 在 `learning-catalog.ts` 拆分精品课程与 legacy lessons
- 在课程入口页加入默认收起的章节课程容器
- 保持原有路由不变，仅新增 L-2a 精品课程入口

**Step 4: 重跑测试确认通过**

Run: `npx --yes tsx scripts/tests/test-interactive-courses-page.ts`

### Task 2: 新课路由骨架与课堂入口

**Files:**
- Create: `src/app/interactive-learning/courses/l2a-time-domain-fasttrack/page.tsx`
- Create: `src/app/interactive-learning/courses/l2a-time-domain-fasttrack/teacher/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/l2a-time-domain-fasttrack/student/[sessionId]/page.tsx`
- Create: `src/features/interactive/l2a-time-domain/entry-page.tsx`
- Create: `src/lib/l2a-course.ts`
- Test: `scripts/tests/test-l2a-course-structure.ts`

**Step 1: 写失败测试**

验证：
- 存在新课入口、教师端、学生端路由
- `src/lib/l2a-course.ts` 导出课程标题、步骤列表和阶段映射

**Step 2: 运行测试确认失败**

Run: `npx --yes tsx scripts/tests/test-l2a-course-structure.ts`

**Step 3: 实现骨架**

- 复用现有 session clone/join 流程
- 先确保 demo、student、teacher 路由可访问
- 在 `l2a-course.ts` 中定义 18 步、时长、常驻工作区步骤等基础配置

**Step 4: 重跑测试确认通过**

Run: `npx --yes tsx scripts/tests/test-l2a-course-structure.ts`

### Task 3: 双面板工作区

**Files:**
- Create: `src/features/interactive/l2a-time-domain/workspace.tsx`
- Create: `src/features/interactive/l2a-time-domain/workspace-content.tsx`
- Create: `src/features/interactive/l2a-time-domain/use-l2a-workspace-state.ts`
- Test: `scripts/tests/test-l2a-workspace-state.ts`

**Step 1: 写失败测试**

验证工作区配置与状态逻辑：
- 默认包含极点面板 + 时域面板
- 禁用频域面板
- 支持记录 `zeta`、`wn`、测量值、探索记录

**Step 2: 运行测试确认失败**

Run: `npx --yes tsx scripts/tests/test-l2a-workspace-state.ts`

**Step 3: 最小实现**

- 复用 `lesson-07` 的二阶响应计算思路
- 暴露给教师/学生页相同的工作区组件
- 使用 `useInteractiveTracking` 发出 `view/interact/submit/complete/param_change`

**Step 4: 重跑测试确认通过**

Run: `npx --yes tsx scripts/tests/test-l2a-workspace-state.ts`

### Task 4: 教师端与学生端 18 步内容

**Files:**
- Create: `src/features/interactive/l2a-time-domain/teacher-page.tsx`
- Create: `src/features/interactive/l2a-time-domain/student-page.tsx`
- Create: `src/features/interactive/l2a-time-domain/course-header.tsx`
- Modify: `src/lib/l2a-course.ts`
- Test: `scripts/tests/test-l2a-step-config.ts`

**Step 1: 写失败测试**

验证：
- 18 个步骤完整存在且顺序正确
- 常驻工作区步骤全部包含在 `WORKSPACE_PERSIST_STEP_IDS`
- 关键步骤（前测/后测/总结）具备教师端与学生端文案配置

**Step 2: 运行测试确认失败**

Run: `npx --yes tsx scripts/tests/test-l2a-step-config.ts`

**Step 3: 实现**

- 复用“柔性之海”顶部导航样式与双端同步逻辑
- 教师端支持提问释放、前后测发放、学生答复汇总
- 学生端支持预测、记录、测量、开放题提交与学习记录回显

**Step 4: 重跑测试确认通过**

Run: `npx --yes tsx scripts/tests/test-l2a-step-config.ts`

### Task 5: 文档与验证

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 更新文档**

记录：
- L-2a 新增精品互动课堂
- 互动课程入口改为精品课程 + 折叠 legacy lessons
- 工作区与埋点复用方式

**Step 2: 运行验证**

Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`

如相关页面已有集成测试入口，再补跑对应脚本。
