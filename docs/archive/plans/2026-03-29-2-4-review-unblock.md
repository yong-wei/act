# 2-4 Review Unblock Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐 `2-4` 的正式课次映射、元数据与知识卡片输入，使课程审查脚本可执行并输出 review/runtime 结果。

**Architecture:** 先修结构阻断，再跑审查。具体顺序是：补 `lesson-id-map` 主线映射，建立 `manifest.json`，补 `knowledge/cards/lessons/2-4/sequence.json` 与缺失节点卡片，最后运行 `review_lesson_content.py --lesson 2-4` 并根据 review 结果继续修正。

**Tech Stack:** JSON / Markdown / Python 审查脚本 / 课程 authoring-runtime 导出链路

### Task 1: 补齐课次映射

**Files:**
- Modify: `course-content/authoring/shared/lesson-id-map.json`

**Step 1:** 按 `module-skeletons.md` 与 `unit-design-details/module2.md` 增加 `2-4` 主线条目。

**Step 2:** 确认 `authoring_lesson_dir`、`authoring_cards_dir`、`runtime_lesson_dir` 都指向 `2-4`。

**Step 3:** 保存后用最小 Python 读取脚本验证 `2-4` 可被 `lesson_id_map.py` 识别。

### Task 2: 建立 2-4 manifest

**Files:**
- Create: `course-content/authoring/lessons/2-4/manifest.json`
- Read: `course-content/authoring/lessons/2-4/design/handout.md`
- Read: `course-content/authoring/lessons/2-4/design/boppps.md`

**Step 1:** 从正文主线提炼 `title`、`unit_type`、`knowledge_type`、前后衔接信息。

**Step 2:** 选择最小必要的 `focus_node_ids` / `reuse_node_ids` / `card_order`。

**Step 3:** 使用 `reuse-only` 或最小 graph 版本，避免无必要新建课次图谱分包。

### Task 3: 补齐知识卡片序列与节点卡片

**Files:**
- Create: `course-content/authoring/knowledge/cards/lessons/2-4/sequence.json`
- Create/Modify: `course-content/authoring/knowledge/cards/nodes/*.md`

**Step 1:** 先确定 `2-4` 使用的节点是否已存在于知识图谱。

**Step 2:** 为缺失节点建立符合规范的卡片文件，至少包含 frontmatter、`## 首页`、`## 详情`。

**Step 3:** 若已有节点卡片缺少 `lesson_units: 2-4` 或 `source_docs`，补齐而不重写无关内容。

### Task 4: 运行审查并收口

**Files:**
- Run: `python3 course-content/scripts/review_lesson_content.py --lesson 2-4`
- Inspect: `course-content/runtime/lessons/2-4/review/*`

**Step 1:** 运行脚本，记录首个阻断项。

**Step 2:** 若是结构性缺口，回修 authoring。

**Step 3:** 审查通过后，总结结构正确性、事实正确性、科学合理性、确定性验证四层结论。
