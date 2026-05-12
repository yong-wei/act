# Resource Library Skill Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `course-content/resource-library/` 正式纳入课程大纲重构与课程制作技能，使资源使用从“可参考”升级为“有入口、有筛选、有边界、有追溯”的正式流程。

**Architecture:** 先新增一份统一的资源融入规范，明确资源类型、筛选原则、单元级评审单和产物级转写规则；再分别修改 `.codex/skills/syllabus-refactor/SKILL.md` 与 `.codex/skills/lesson/SKILL.md`，把资源读取顺序、候选筛选、采用级别与产物落点写成显式步骤；最后做一次最小一致性检查，确认路径、步骤编号与现有课程边界不冲突。

**Tech Stack:** Markdown、技能文档、`apply_patch`、`rg`

---

### Task 1: 建立失败基线与统一规范骨架

**Files:**
- Verify: `.codex/skills/syllabus-refactor/SKILL.md`
- Verify: `.codex/skills/lesson/SKILL.md`
- Create: `course-content/resource-library/integration-framework.md`

**Steps:**
1. 检查两个技能中是否已有 `resource-library` 的正式读取入口、筛选节点与回写要求。
2. 记录当前缺口：缺少显式资源读取顺序、缺少单元级资源评审单、缺少按产物转写规则。
3. 新建统一规范文档，定义资源类型、模块适配建议、采用级别、追溯字段与产物映射。

### Task 2: 改造 syllabus-refactor 技能

**Files:**
- Modify: `.codex/skills/syllabus-refactor/SKILL.md`
- Reference: `course-content/resource-library/integration-framework.md`

**Steps:**
1. 在启动协议中加入资源融入规范与相关索引文件的读取规则。
2. 增加资源库正式输入定位与不可协商规则。
3. 在工作流中加入“资源候选筛查 / 资源融入评审单”步骤。
4. 在输出要求中加入资源采用级别、落点与排除理由。

### Task 3: 改造 lesson 技能

**Files:**
- Modify: `.codex/skills/lesson/SKILL.md`
- Reference: `course-content/resource-library/integration-framework.md`

**Steps:**
1. 在硬约束中加入“资源库只作候选源，不直接拼贴成课”。
2. 把工作流从 7 步升级为 8 步，在元数据确认后加入资源选材步骤。
3. 为讲义、BOPPPS、互动页、多媒体分别补充资源转写规则。
4. 确认实践课分支、步骤编号与收尾验证仍保持自洽。

### Task 4: 最小验证与结果复核

**Files:**
- Verify: `course-content/resource-library/integration-framework.md`
- Verify: `.codex/skills/syllabus-refactor/SKILL.md`
- Verify: `.codex/skills/lesson/SKILL.md`

**Steps:**
1. 用 `rg` 检查三个文件中关于 `resource-library`、索引路径和步骤编号的引用是否完整。
2. 复查 `lesson` 技能的步骤顺序与交叉引用，避免出现旧编号残留。
3. 复查 `syllabus-refactor` 技能的输出块定义，确认与资源规范一致。
