# L2B Entry Runtime Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 runtime 知识资源的最新规则固化到技能中，并把 L-2b 首页接入知识点网络、卡片预览和讲义入口。

**Architecture:** 在 `export-runtime` 中把 `content/concepts` 兼容卡片按知识节点 ID 重命名并映射到 runtime 节点资源；入口页通过服务端读取 `course-content/runtime/lessons/L-2b/lesson.json`、`graph-overlay.json` 与 `handout.md`，渲染首页知识点网络、卡片预览和讲义弹层。技能文件同步补充统一结构、runtime 导出、首页设计和收尾验收规则。

**Tech Stack:** Next.js 14、TypeScript、React、Node 文件读取、Bash、Python 3、React Markdown / KaTeX。

### Task 1: 写失败测试

**Files:**
- Create: `scripts/tests/test-runtime-concepts-node-mapping.ts`
- Create: `scripts/tests/test-l2b-entry-runtime-content.ts`
- Modify: `scripts/tests/test-interactive-lesson-skill.ts`

**Step 1: Write the failing test**

- `test-runtime-concepts-node-mapping.ts`
  - 断言 `course-content/runtime/knowledge/cards/concepts/相角裕度_5_5a74b451.mdx` 存在
  - 断言旧 slug `phase-margin.mdx` 不再作为 runtime 映射文件被直接引用
  - 断言 `nodes.json` 中对应节点资源指向 node_id 形式的 concepts 文件
- `test-l2b-entry-runtime-content.ts`
  - 断言 `src/features/interactive/l2b-root-locus/entry-page.tsx` 包含知识点网络区、卡片预览区、讲义入口
  - 断言入口页使用 runtime lesson/graph/handout 数据，而不是手写静态内容
- `test-interactive-lesson-skill.ts`
  - 增加对 `course-content/runtime` 唯一来源、`export-runtime.sh`、首页知识图、卡片预览、讲义入口、L-2c 统一结构的断言

**Step 2: Run test to verify it fails**

Run:

```bash
npx --yes tsx scripts/tests/test-runtime-concepts-node-mapping.ts
npx --yes tsx scripts/tests/test-l2b-entry-runtime-content.ts
npx --yes tsx scripts/tests/test-interactive-lesson-skill.ts
```

Expected: FAIL。

### Task 2: 实现 concepts 到 node_id 的 runtime 映射

**Files:**
- Modify: `course-content/scripts/export_runtime.py`

**Step 1: Write the failing test**

复用 `test-runtime-concepts-node-mapping.ts`。

**Step 2: Run test to verify it fails**

同 Task 1。

**Step 3: Write minimal implementation**

- 从 concepts 卡片标题提取中文名称
- 在当前知识库节点中做名称精确匹配
- 将匹配成功的 runtime concepts 文件重命名为 `<node_id>.mdx`
- 将 runtime 节点资源优先映射到 `cards/nodes/<node_id>.md`，若不存在则回退到 `cards/concepts/<node_id>.mdx`

**Step 4: Run test to verify it passes**

Run:

```bash
bash course-content/scripts/export-runtime.sh L-2b
npx --yes tsx scripts/tests/test-runtime-concepts-node-mapping.ts
```

Expected: PASS。

### Task 3: 实现 L-2b 首页 runtime 内容接入

**Files:**
- Create: `src/lib/course-runtime.ts`
- Modify: `src/app/interactive-learning/courses/l2b-root-locus-fasttrack/page.tsx`
- Modify: `src/features/interactive/l2b-root-locus/entry-page.tsx`
- Create: `src/features/interactive/l2b-root-locus/entry-runtime-sections.tsx`（如需要）

**Step 1: Write the failing test**

复用 `test-l2b-entry-runtime-content.ts`。

**Step 2: Run test to verify it fails**

同 Task 1。

**Step 3: Write minimal implementation**

- 服务端读取 `lesson.json`、`graph-overlay.json`、`handout.md`
- 入口页新增：
  - 默认显示本课知识点局部网络
  - 点击节点显示卡片正面
  - “更多” 打开完整卡片详情
  - 页面底部按 `sequence.card_order` 渲染卡片预览
  - 讲义入口与讲义详情弹层
- 保持现有教师创建、学生加入、演示模式入口不回退

**Step 4: Run test to verify it passes**

Run:

```bash
npx --yes tsx scripts/tests/test-l2b-entry-runtime-content.ts
```

Expected: PASS。

### Task 4: 更新技能并回归验证

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/SKILL.md`
- Modify: `.codex/skills/interactive-lesson-implementation/notes/L-2b.md`

**Step 1: Write the failing test**

复用 `test-interactive-lesson-skill.ts`。

**Step 2: Run test to verify it fails**

同 Task 1。

**Step 3: Write minimal implementation**

- 在技能中明确：
  - `L-2c` 为唯一正确结构
  - 首页必须包含知识点网络、卡片正面/详情、讲义入口、底部卡片预览
  - runtime 为唯一运行时来源
  - `export-runtime.sh` 为默认迁移通道
  - `content/concepts` 兼容卡片需按 node_id 映射
  - 无法自动迁移时按内容理解在 runtime 重建
  - 实现后需做文件链路、页面链路、首页模块与讲义渲染验收

**Step 4: Run test to verify it passes**

Run:

```bash
npx --yes tsx scripts/tests/test-interactive-lesson-skill.ts
npx --yes tsx scripts/tests/test-runtime-concepts-node-mapping.ts
npx --yes tsx scripts/tests/test-l2b-entry-runtime-content.ts
npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts
npx --yes tsx scripts/tests/test-runtime-knowledge-source.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts
npm run lint
```

Expected: PASS。
