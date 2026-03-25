# 豪华邮轮课堂实录互动流程 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `interactive-learning/courses` 下新增“精品课程”入口，并落地一套服务于45分钟课堂实录的 BOPPPS 互动流程（教师端/学生端）。

**Architecture:** 采用“新课程路由 + 统一状态机页面”方案：入口层在 `courses` 页新增“精品课程”分区；课程层使用单页分步流程（BOPPPS阶段 + 环节名 + 提示）组织教师端/学生端内容；仿真能力通过复用已有 `/simulations/cruise` 与 `/interactive-learning/multi-representation-linkage` 实现，不新建邮轮仿真引擎。

**Tech Stack:** Next.js App Router、React hooks、Tailwind、Playwright。

### Task 1: 测试先行（RED）

**Files:**
- Create: `tests/cruise-boppps-premium-course.spec.ts`

**Steps:**
1. 新增用例：校验 `精品课程` 标题、新课程入口卡片与新路由可访问。
2. 运行：`npx playwright test tests/cruise-boppps-premium-course.spec.ts --reporter=line`
3. 期望：失败（当前无精品课程入口）。

### Task 2: 入口注册

**Files:**
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/app/interactive-learning/courses/page.tsx`

**Steps:**
1. 在 catalog 中新增 `PREMIUM_LESSONS`，将“柔性之海课堂实录”放在首位。
2. `courses/page.tsx` 新增“精品课程”区块并优先渲染。
3. 保留并下移原章节课程列表。

### Task 3: 新增课程主页面骨架

**Files:**
- Create: `src/app/interactive-learning/courses/cruise-comfort-boppps/page.tsx`

**Steps:**
1. 实现统一全屏布局（顶部阶段条 + 环节名 + 必要提示）。
2. 实现教师/学生视图切换、步骤导航、阶段状态模型。
3. 按课堂实录时间线映射 B/O/P1/P2/P3/S 环节。

### Task 4: 关键互动能力实现

**Files:**
- Modify: `src/app/interactive-learning/courses/cruise-comfort-boppps/page.tsx`

**Steps:**
1. B阶段视频：优先播放 `/videos/luxury-liner-intro.mp4`，读取失败展示空白播放框。
2. O阶段：教师端布鲁姆动词目标设计 + 一键生成学生个性化目标；学生加入课堂后可见。
3. 前测：生成2道能力点自适应题；教师“发放”按钮；统计柱状图按能力点展示班级作答。
4. 工程目标设定与仿真联动：嵌入/跳转现有 `/simulations/cruise`，步骤化填写并允许切换步骤。
5. 第一轮参数探索：提供跨域入口（`/interactive-learning/multi-representation-linkage`）与返回；支持手动极点调整并同步映射控制器参数展示。
6. AI介入、结构化提示词、暂停反思/反思调整、一致性校验、小组对比、收尾总结：按教师静态文案 + 学生仿真操作组织。

### Task 5: NeuralODE 教师静态页资源

**Files:**
- Create: `public/assets/cruise-comfort-boppps/neuralode-overview.svg`
- Modify: `src/app/interactive-learning/courses/cruise-comfort-boppps/page.tsx`

**Steps:**
1. 在 `public/assets` 下新建本课专属目录。
2. 教师端单独环节嵌入图片和说明文案；学生端保持不变。

### Task 6: 验证与文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Steps:**
1. 运行目标用例：`npx playwright test tests/cruise-boppps-premium-course.spec.ts --reporter=line`
2. 运行全局校验：`npm run lint`、`npm run test`、`npm run build`
3. 更新 `docs/ProjectDescription.md` 中相关实现说明。
