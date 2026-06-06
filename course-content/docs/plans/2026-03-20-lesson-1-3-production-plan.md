# Lesson 1-3 Production Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 `1-3` 课次在作者态下的知识图谱增量、BOPPPS 教案、互动页面蓝图与多模态资源设计文档。

**Architecture:** 以已完成的 `handout.md` 为唯一内容母本，按照 `.agents/skills/lesson/SKILL.md` 的 Step 4-7 顺序产出派生文档。所有结构字段与目录布局对齐 `1-2` 已有产物，保证后续 runtime 导出与图谱同步链路可复用。

**Tech Stack:** Markdown, JSON, JSONL, Python3 校验脚本, lesson 技能规范。

### Task 1: 对齐规范与模板

**Files:**
- Read: `.agents/skills/lesson/references/step4-knowledge-graph.md`
- Read: `.agents/skills/lesson/references/step5-boppps.md`
- Read: `.agents/skills/lesson/references/step6-interactive-page.md`
- Read: `.agents/skills/lesson/references/step7-multimedia.md`
- Read: `authoring/lessons/legacy/1-2/manifest.json`
- Read: `authoring/lessons/legacy/1-2/graph/nodes.jsonl`
- Read: `authoring/lessons/legacy/1-2/graph/relations.jsonl`
- Read: `authoring/lessons/legacy/1-2/design/1-2-boppps.md`
- Read: `authoring/lessons/legacy/1-2/design/1-2-interactive-page.md`
- Read: `authoring/lessons/legacy/1-2/design/1-2-multimedia.md`

**Step 1:** 提取必需字段、命名风格与文档栏目。
**Step 2:** 记录 `1-3` 需要新增的文件清单与约束。

### Task 2: 产出图谱增量

**Files:**
- Create: `authoring/lessons/2-2/manifest.json`
- Create: `authoring/lessons/2-2/graph/nodes.jsonl`
- Create: `authoring/lessons/2-2/graph/relations.jsonl`
- Modify/Create: `authoring/knowledge/cards/lessons/2-2/sequence.json`

**Step 1:** 根据 `handout.md` 拆出新增节点与复用节点。
**Step 2:** 写入 `manifest.json`、`nodes.jsonl`、`relations.jsonl`、`sequence.json`。
**Step 3:** 用 Python3 做 JSON/JSONL 基础校验。

### Task 3: 产出 BOPPPS 教案

**Files:**
- Create: `authoring/lessons/2-2/design/2-2-boppps.md`

**Step 1:** 以讲义为母本设计 BOPPPS 七段。
**Step 2:** 明确各阶段教师动作、学生动作、AI 融入点、板书/媒体调用。
**Step 3:** 校验与 `handout.md`、后续课程衔接一致。

### Task 4: 产出互动页面蓝图

**Files:**
- Create: `authoring/lessons/2-2/design/2-2-interactive-page.md`

**Step 1:** 先定义页面步骤框架与学习流。
**Step 2:** 为每一步补全目标、交互、数据、AI 提示、媒体占位。
**Step 3:** 确保与 BOPPPS 和讲义章节一一映射。

### Task 5: 产出多模态资源设计

**Files:**
- Create: `authoring/lessons/2-2/design/2-2-multimedia.md`

**Step 1:** 扫描讲义与互动页引用，形成资源总表。
**Step 2:** 为每个资源写清用途、规格、文件名、制作方式和插入位置。
**Step 3:** 确认图文占位与互动前端绘制需求闭环。

### Task 6: 验证与汇报

**Files:**
- Verify: `authoring/lessons/2-2/**`

**Step 1:** 运行 Python3 脚本检查 JSON/JSONL 结构和必需文件存在性。
**Step 2:** 汇总新增文件、核心设计点、待后续补做项。
