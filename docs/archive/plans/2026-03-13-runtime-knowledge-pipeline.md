# Runtime Knowledge Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 打通 `course-content/authoring` 到 `course-content/runtime` 的知识资源导出链路，并让知识图/API 以 `course-content/runtime` 作为唯一文件源完成 L-2b 迁移验证。

**Architecture:** 新增一个由 `course-content/scripts/export-runtime.sh` 驱动的导出流程，统一生成 `runtime/knowledge` 与 `runtime/lessons/<lesson>` 发布产物。接口层不再读取根目录 `data/`，而改为读取 runtime 生成的全局知识包；同时兼容 `content/concepts` 旧卡片，将其迁移到 `runtime/knowledge/cards/concepts` 并让卡片显示同时支持 `content/concepts/*` 与 `course-content/runtime/knowledge/cards/nodes/*`。

**Tech Stack:** Next.js 14、TypeScript、Node 文件 API、Bash、Python 3、现有课程 authoring/runtime 目录结构。

### Task 1: 写失败测试，锁定 runtime 导出目标

**Files:**
- Create: `scripts/tests/test-runtime-knowledge-export.ts`
- Create: `scripts/tests/test-runtime-knowledge-source.ts`
- Modify: `scripts/tests/test-l2b-runtime-route.ts`

**Step 1: Write the failing test**

- `test-runtime-knowledge-export.ts`
  - 断言 `course-content/runtime/knowledge/graph/nodes.json`
  - 断言 `course-content/runtime/knowledge/graph/relations.jsonl`
  - 断言 `course-content/runtime/knowledge/cards/nodes/极点迁移_4_L2b001.md`
  - 断言 `course-content/runtime/knowledge/cards/concepts/phase-margin.mdx`
  - 断言 `course-content/runtime/lessons/legacy/L-2b/lesson.json`
  - 断言 `course-content/runtime/lessons/legacy/L-2b/graph-overlay.json`
- `test-runtime-knowledge-source.ts`
  - 断言 `src/lib/knowledge-graph-source.ts` 读取 `course-content/runtime`
  - 断言不再读取根目录 `data/knowledge_graph.json`
  - 断言 `src/app/api/content/mdx/route.ts` 允许 `course-content/runtime` 下 `.md/.mdx`
- `test-l2b-runtime-route.ts`
  - 增加对 `lesson.json`、`graph-overlay.json` 与 runtime markdown/knowledge cards 的链路断言

**Step 2: Run test to verify it fails**

Run:

```bash
npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts
npx --yes tsx scripts/tests/test-runtime-knowledge-source.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts
```

Expected: FAIL，提示 runtime 知识导出文件和 runtime 读取逻辑尚未实现。

### Task 2: 实现导出脚本与 L-2b 运行时产物

**Files:**
- Modify: `course-content/scripts/export-runtime.sh`
- Create: `course-content/scripts/export_runtime.py`
- Create: `course-content/runtime/knowledge/.gitkeep`（如需要）

**Step 1: Write the failing test**

复用 Task 1 的失败测试，不新增实现代码前不调整断言。

**Step 2: Run test to verify it fails**

同 Task 1。

**Step 3: Write minimal implementation**

- `export-runtime.sh`
  - 支持 `L-2b` 与 `--all`
  - 调用 `python3 course-content/scripts/export_runtime.py ...`
- `export_runtime.py`
  - 合并 `authoring/knowledge/base/*` 与 `authoring/lessons/<lesson>/graph/*`
  - 输出 `runtime/knowledge/graph/nodes.json`
  - 输出 `runtime/knowledge/graph/relations.jsonl`
  - 复制 `authoring/knowledge/cards/nodes/*.md` 到 `runtime/knowledge/cards/nodes/`
  - 复制 `content/concepts/*.mdx` 到 `runtime/knowledge/cards/concepts/`
  - 为 `L-2b` 生成 `runtime/lessons/legacy/L-2b/lesson.json`
  - 为 `L-2b` 生成 `runtime/lessons/legacy/L-2b/graph-overlay.json`
  - 将 `authoring/lessons/legacy/L-2b/design/handout.md` 导出到 runtime，并按 runtime 媒体路径改写相对图片引用
  - 调用现有 L-2b 媒体脚本生成/刷新 `runtime/lessons/legacy/L-2b/media/*.svg`

**Step 4: Run test to verify it passes**

Run:

```bash
bash course-content/scripts/export-runtime.sh L-2b
npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
```

Expected: PASS。

### Task 3: 切换知识图与 Markdown 读取到 runtime

**Files:**
- Modify: `src/lib/knowledge-graph-source.ts`
- Modify: `src/app/api/content/mdx/route.ts`
- Modify: `src/features/knowledge/knowledge-card.tsx`
- Modify: `src/components/shared/mdx-slide.tsx`（仅当需要）

**Step 1: Write the failing test**

复用 Task 1 的 `test-runtime-knowledge-source.ts`。

**Step 2: Run test to verify it fails**

同 Task 1。

**Step 3: Write minimal implementation**

- `knowledge-graph-source.ts`
  - 改为读取 `course-content/runtime/knowledge/graph/nodes.json` 与 `relations.jsonl`
  - 将 runtime 节点资源与卡片资源填充到统一 payload
- `api/content/mdx/route.ts`
  - 支持 `.md` 与 `.mdx`
  - 白名单支持 `content/` 与 `course-content/runtime/`
- `knowledge-card.tsx`
  - 支持 runtime `.md`/`.mdx` 卡片路径
  - 保留 `content/concepts/*` 兼容

**Step 4: Run test to verify it passes**

Run:

```bash
npx --yes tsx scripts/tests/test-runtime-knowledge-source.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts
```

Expected: PASS。

### Task 4: 验证 L-2b 迁移闭环并记录试点结果

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/notes/L-2b.md`
- Modify: `docs/ProjectDescription.md`（如本轮变更影响项目说明）

**Step 1: Write the failing test**

复用已有链路测试；若验证缺口暴露，再补充最小回归测试。

**Step 2: Run test to verify it fails**

仅在新增回归测试时执行。

**Step 3: Write minimal implementation**

- 更新 L-2b 试点笔记，记录：
  - runtime 产物结构
  - 自动迁移范围
  - 尚未自动化的部分
  - 对技能固化的反向约束

**Step 4: Run test to verify it passes**

Run:

```bash
npx --yes tsx scripts/tests/test-runtime-knowledge-export.ts
npx --yes tsx scripts/tests/test-runtime-knowledge-source.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-media.ts
node --experimental-strip-types scripts/tests/test-l2b-runtime-route.ts
npm run lint
```

Expected: PASS；若 lint 受本仓库既有脏改动影响，至少说明受影响范围与原因。
