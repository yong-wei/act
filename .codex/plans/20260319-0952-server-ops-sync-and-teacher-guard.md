# Server Ops Sync And Teacher Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将线上数据库同步到本地分析环境，补齐仓库内 `server-ops` 技能，并修复教师驾驶舱服务端空会话崩溃后完成重新部署与验收。

**Architecture:** 本次工作分三条线并行收敛：先按服务器运维流程完成远端数据库导出、本地备份和覆盖恢复；随后把 `.claude/skills/server-ops` 抽象成仓库内 `.codex/skills/server-ops` 的轻入口 + 参考文档结构；最后修复教师页服务端鉴权守卫，重新构建镜像并部署到 Podman 生产栈，结合日志、接口和容器状态完成验收。

**Tech Stack:** Next.js 14、Prisma、PostgreSQL、Redis、BullMQ、Podman、systemd、SSH、Bash

### Task 1: 远端数据库同步到本地

**Files:**
- Modify: `data/backups/`
- Reference: `.codex/skills/server-ops/references/database-sync.md`

**Step 1: 备份本地库**

Run: `pg_dump -h localhost -U act_user -d act_obe -Fc -f "data/backups/local_act_obe_before_remote_sync_$(date +%Y%m%d_%H%M%S).dump"`

Expected: 生成新的本地备份文件。

**Step 2: 导出并下载远端库**

Run: `ssh root@121.40.124.135 "podman exec act-obe-postgres pg_dump -U act_user -d act_obe -Fc" > data/backups/remote_act_obe_sync_$(date +%Y%m%d_%H%M%S).dump`

Expected: 本地生成远端导出的 dump。

**Step 3: 重建本地数据库并恢复**

Run: `dropdb --if-exists act_obe && createdb -O act_user act_obe && pg_restore -h localhost -U act_user -d act_obe --no-owner --no-privileges data/backups/remote_act_obe_sync_xxx.dump`

Expected: 恢复完成，不再被 `shadow` schema 依赖卡住。

**Step 4: 核对关键计数**

Run: `psql -h localhost -U act_user -d act_obe -c "select ..."`

Expected: `User`、`StudentCompetencySnapshot`、`ClassCompetencySnapshot`、`StudentProfileSummary` 等计数与线上一致。

### Task 2: 创建仓库内 server-ops 技能

**Files:**
- Create: `.codex/skills/server-ops/SKILL.md`
- Create: `.codex/skills/server-ops/references/remote-investigation.md`
- Create: `.codex/skills/server-ops/references/deploy-and-verify.md`
- Create: `.codex/skills/server-ops/references/database-sync.md`
- Create: `.codex/skills/server-ops/references/test-accounts.md`
- Reference: `.claude/skills/server-ops/README.md`
- Reference: `.claude/skills/server-ops/skill.yaml`

**Step 1: 整理主入口**

Expected: `SKILL.md` 只保留适用场景、引用关系和通用操作规则。

**Step 2: 拆分详细流程**

Expected: 四类工作流拆分到 `references/`，避免把所有远端操作堆在入口。

**Step 3: 核对与参考源的一致性**

Expected: `.codex/skills/server-ops` 覆盖部署、验收、数据库同步、测试账号核对四类高频流程。

### Task 3: 修复教师驾驶舱服务端崩溃

**Files:**
- Modify: `src/app/teacher/page.tsx`
- Modify: `src/app/teacher/resources/page.tsx`
- Create: `scripts/tests/test-teacher-auth-guards.mjs`

**Step 1: 为教师页补空会话守卫**

Expected: `!session?.user` 时立即 `redirect('/login')`。

**Step 2: 为非教师角色补分流**

Expected: `ADMIN` 重定向 `/admin`，其他角色重定向 `/dashboard`。

**Step 3: 补充回归脚本**

Run: `node scripts/tests/test-teacher-auth-guards.mjs`

Expected: 输出 `teacher auth guard test passed`。

### Task 4: 重新部署并做远端验收

**Files:**
- Modify: `docs/ProjectDescription.md`
- Reference: `.codex/skills/server-ops/references/deploy-and-verify.md`

**Step 1: 本地构建**

Run: `bash scripts/build.sh`

Expected: 输出镜像 tar 与 SHA256。

**Step 2: 远端部署**

Run: `bash scripts/remote-deploy.sh --skip-build`

Expected: 远端 app/worker 使用新镜像重建。

**Step 3: 远端验收**

Run:
- `ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}' | grep act-obe"`
- `ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"`
- `curl -k -I -s https://act.adapt-learn.online/teacher`
- `ssh root@121.40.124.135 "podman logs --since 5m act-obe-app | tail -n 120"`

Expected: `/teacher` 不再触发 500，日志中不再出现 `Cannot read properties of null (reading 'user')`，Redis/worker 仍正常。
