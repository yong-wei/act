# Codex Memory Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `.codex/memory` 下建立可渐进读取的长期记忆骨架，并预置首批项目现状模板。

**Architecture:** 采用“总览 -> 领域索引 -> 叶子主题 -> 决策/事故”的金字塔结构，优先让 AI 先读最小总览，再按主题逐层下钻。稳定规则保留在 `AGENTS.md`，阶段进展保留在 `docs/ProjectDescription.md`，`.codex/memory` 只记录适合跨会话复用的长期项目记忆。

**Tech Stack:** Markdown、目录层级、Codex/Serena 渐进式文件读取约定

### Task 1: 设计记忆层级

**Files:**
- Create: `.codex/memory/README.md`
- Create: `.codex/memory/00-index.md`
- Create: `.codex/memory/01-reading-map.md`

**Step 1: 明确读取顺序**

定义“默认先读什么、遇到什么问题再读什么”的规则，避免根目录成为杂乱入口。

**Step 2: 设计根目录索引**

将根目录文件限定为：
- 目录说明
- 全局索引
- 渐进读取说明

**Step 3: 约束每个记忆文件的固定头部**

统一字段：
- 状态
- 最后更新
- 摘要
- 上游
- 下游
- 相关

### Task 2: 建立主题分层目录

**Files:**
- Create: `.codex/memory/10-project/*`
- Create: `.codex/memory/20-architecture/*`
- Create: `.codex/memory/30-operations/*`
- Create: `.codex/memory/40-domain/*`
- Create: `.codex/memory/50-decisions/00-index.md`
- Create: `.codex/memory/60-incidents/*`
- Create: `.codex/memory/70-workflows/*`
- Create: `.codex/memory/90-archive/README.md`

**Step 1: 区分稳定性与主题**

按项目总览、架构、运维、业务领域、决策、事故、流程分目录，避免时间线式堆积。

**Step 2: 为每个目录提供索引文件**

每个目录保留 `00-index.md`，用于说明该目录回答哪些问题、何时需要继续下钻。

### Task 3: 预置首批项目现状

**Files:**
- Create: `.codex/memory/10-project/10-current-state.md`
- Create: `.codex/memory/20-architecture/20-course-runtime.md`
- Create: `.codex/memory/20-architecture/30-auth-and-session.md`
- Create: `.codex/memory/30-operations/30-database-and-migrations.md`
- Create: `.codex/memory/30-operations/50-known-deploy-risks.md`
- Create: `.codex/memory/60-incidents/2026-03-16-session-api-auth-vs-deploy.md`

**Step 1: 只写高价值事实**

记录当前主干架构、鉴权链路、部署风险和一条真实事故，避免空模板无价值。

**Step 2: 明确“结论”和“证据”分离**

叶子文件先给结论，再列证据来源和后续行动，便于 AI 快速判断是否需要继续读。

### Task 4: 与现有文档体系对齐

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 补充记忆骨架落地说明**

在项目状态部分增加一条说明，声明 `.codex/memory` 的用途与边界。

### Task 5: 结构校验

**Files:**
- Verify: `.codex/memory/**/*`

**Step 1: 列出全部文件并检查层级**

Run: `find .codex/memory -maxdepth 3 -type f | sort`

Expected: 出现根索引、目录索引、叶子主题、事故与流程文件。

**Step 2: 抽查关键文件**

Run: `sed -n '1,80p' .codex/memory/00-index.md`
Run: `sed -n '1,120p' .codex/memory/20-architecture/30-auth-and-session.md`

Expected: 文件头和交叉引用完整，可直接作为后续维护入口。
