# Data Governance Fact Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复课堂事件归一化与事实沉淀链路，验证本地对齐远端数据库后能否产出预期 `LearningFact`，并将远端数据库全量替换本地开发库的确定性流程固化到本地 `server-ops` skill。

**Architecture:** 保持课堂事件入口、事件类型注册表、worker 事实映射三层一致，先通过契约测试锁定失败点，再以数据库对齐脚本和事实回放脚本验证真实数据。skill 主入口只保留总览，详细操作放在 reference，减少未来服务器操作时的上下文负担。

**Tech Stack:** Next.js 14, TypeScript, Prisma, PostgreSQL, BullMQ, Podman 运维脚本

### Task 1: 回归当前课堂事件契约

**Files:**
- Modify: `src/app/api/interactive/events/route.ts`
- Test: `scripts/tests/test-classroom-event-api-contract.ts`
- Test: `scripts/tests/test-data-governance-event-normalization.mjs`

**Step 1: 运行课堂事件契约测试**

Run: `node scripts/tests/test-classroom-event-api-contract.ts`

**Step 2: 运行数据治理归一化测试**

Run: `node scripts/tests/test-data-governance-event-normalization.mjs`

**Step 3: 若失败，补最小修复**

目标：
- 兼容仅传 `resourceId` 的旧 payload
- 继续使用规范化后的事件类型决定 `priority`

**Step 4: 重新运行两项测试确认通过**

### Task 2: 验证代码质量与构建

**Files:**
- Modify: `src/lib/data-governance/event-types.ts`
- Modify: `src/lib/data-governance/event-normalization.ts`
- Modify: `scripts/workers/data-governance-worker.ts`
- Test: `npm run lint`
- Test: `npm run build`

**Step 1: 运行 lint**

Run: `npm run lint`

**Step 2: 运行 build**

Run: `npm run build`

### Task 3: 本地数据库对齐与事实回放验证

**Files:**
- Create: `scripts/db/sync-remote-db-to-local.sh`
- Create: `scripts/db/backfill-learning-facts-from-event-batches.ts`

**Step 1: 检查本地数据库是否需重同步**

Run: `bash scripts/db/sync-remote-db-to-local.sh`

**Step 2: 先 dry-run 事实回放**

Run: `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts --dry-run`

**Step 3: 实际写入事实**

Run: `npx tsx scripts/db/backfill-learning-facts-from-event-batches.ts`

**Step 4: 核对库内结果**

Run:
- `psql -d act_obe -c 'select count(*) from "LearningFact";'`
- `psql -d act_obe -c 'select count(distinct "userId") from "LearningFact";'`

### Task 4: 收口本地 server-ops skill 与项目文档

**Files:**
- Modify: `.codex/skills/server-ops/SKILL.md`
- Modify: `.codex/skills/server-ops/references/database-sync.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 基于本次经验调整 skill 入口与 reference**

要求：
- 主入口仅保留总览
- 数据库全量替换本地开发库走脚本

**Step 2: 更新项目说明文档**

记录：
- 事件归一化链路
- LearningFact 回放验证
- 数据库同步脚本化

**Step 3: 整理验证结果，明确暂不部署**
