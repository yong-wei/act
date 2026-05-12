# Memory Maintenance Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为本仓库建立“最小 AGENTS 指针 + 专用记忆维护 skill + 可版本化的 `.codex/memory`/skill 文件”维护机制。

**Architecture:** `AGENTS.md` 只保留极短的治理原则，避免每轮会话都加载详细维护流程；详细的记忆更新步骤、归档判断、交叉引用维护和校验逻辑全部放入专用 skill。为保证长期记忆和 skill 能随仓库同步，需要对 `.gitignore` 做精细放开，只追踪 `.codex/memory/**` 与目标 skill 目录，而不是整个 `.codex/`。

**Tech Stack:** Markdown、Git ignore 规则、Codex skill 目录约定、仓库内长期记忆体系

### Task 1: 让记忆与 skill 可进入版本控制

**Files:**
- Modify: `.gitignore`

**Step 1: 调整 `.codex/` 的忽略策略**

保留对 `.codex/` 的默认忽略，但为以下路径加白名单：

- `.codex/memory/**`
- `.codex/skills/memory-maintenance/**`

建议规则顺序：

```gitignore
.codex/*
!.codex/memory/
!.codex/memory/**
!.codex/skills/
!.codex/skills/memory-maintenance/
!.codex/skills/memory-maintenance/**
```

并继续忽略其他 `.codex` 子目录。

**Step 2: 验证 ignore 结果**

Run: `git check-ignore -v .codex/memory/00-index.md .codex/skills/memory-maintenance/SKILL.md`

Expected: 两个文件都不再被 ignore。

### Task 2: 创建专用记忆维护 skill

**Files:**
- Create: `.codex/skills/memory-maintenance/SKILL.md`
- Optional Create: `.codex/skills/memory-maintenance/references/memory-file-template.md`

**Step 1: 编写 skill 的目标与触发条件**

skill 应覆盖以下触发场景：

- 一次会话产出了稳定且可复用的项目事实
- 新增了长期有效的设计决策
- 出现了一次值得保留的事故复盘
- 形成了高频操作流程
- 现有 memory 文件需要拆分、归档或交叉引用修复

**Step 2: 编写 skill 的执行流程**

skill 至少要包含这些步骤：

1. 先判断内容属于 `project / architecture / operations / domain / decisions / incidents / workflows / archive` 哪一类
2. 再判断是更新现有文件还是新增叶子文件
3. 更新文件头字段：`状态 / 最后更新 / 摘要 / 上游 / 下游 / 相关`
4. 必要时补父级 `00-index.md`
5. 如果内容已失效，移入 `90-archive/`
6. 完成后执行最小校验

**Step 3: 写明不该做的事**

skill 应明确禁止：

- 把临时日志直接写进 memory
- 把规则细节继续堆进 `AGENTS.md`
- 在多个 memory 文件里重复维护同一条事实

### Task 3: 将 `AGENTS.md` 压缩为最小治理指针

**Files:**
- Modify: `AGENTS.md`

**Step 1: 增加极短的长期记忆治理段落**

建议只保留三条：

- 本仓库使用 `.codex/memory/` 保存跨会话长期记忆
- 产生稳定事实、决策、事故复盘或高频流程时，优先更新 memory，而不是扩写 `AGENTS.md`
- 维护 memory 时优先遵循 `.codex/memory/README.md` 与 `memory-maintenance` skill

**Step 2: 避免写入详细流程**

不要把目录分类、归档条件、文件模板、交叉引用细则写进 `AGENTS.md`。

### Task 4: 补 memory 内部的维护入口

**Files:**
- Modify: `.codex/memory/README.md`
- Optional Modify: `.codex/memory/01-reading-map.md`

**Step 1: 在 README 中加入“何时调用 skill”**

示例要点：

- 新增稳定事实时
- 复盘事故后
- 完成重大功能且结论具有长期复用价值时

**Step 2: 让 README 与 skill 分工明确**

- `README.md` 负责静态约定
- `memory-maintenance` skill 负责动态维护流程

### Task 5: 做最小验证

**Files:**
- Verify: `.gitignore`
- Verify: `.codex/skills/memory-maintenance/SKILL.md`
- Verify: `AGENTS.md`
- Verify: `.codex/memory/README.md`

**Step 1: 检查文件已纳入版本控制**

Run: `git status --short`

Expected: 能看到 `.codex/memory/**` 与 `.codex/skills/memory-maintenance/**` 出现在未跟踪或已修改列表中。

**Step 2: 抽查 skill 内容**

Run: `sed -n '1,220p' .codex/skills/memory-maintenance/SKILL.md`

Expected: 能看到触发条件、分类决策、维护步骤、禁忌事项和校验步骤。

**Step 3: 抽查 AGENTS 最小化规则**

Run: `rg -n "长期记忆|memory-maintenance|\\.codex/memory" AGENTS.md`

Expected: 只有简短治理规则，没有大段维护细则。
