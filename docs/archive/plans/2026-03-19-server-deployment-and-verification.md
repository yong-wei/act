# Server Deployment And Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前项目部署到服务器，并确认本次新增的 Redis、后台 worker、scheduler、课堂服务优化与数据治理链路已经按生产要求生效。

**Architecture:** 以现有 `scripts/remote-deploy.sh` 为远端入口，补齐 Podman 侧对 Redis / worker / scheduler / runtime env 的编排与校验；部署后通过容器状态、环境变量、Redis/BullMQ 状态、数据库快照写入与公网接口进行闭环验收。

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, Redis, BullMQ, Podman, systemd, Nginx

### Task 1: 梳理当前部署缺口

**Files:**
- Modify: `deploy/podman/deploy.sh`
- Modify: `deploy/podman/configure-service.sh`
- Modify: `scripts/remote-deploy.sh`
- Modify: `docs/ProjectDescription.md`

**Step 1: 识别当前远端链路缺失的服务**

Run: `sed -n '1,320p' deploy/podman/deploy.sh`
Expected: 仅看到 PostgreSQL + app 容器，没有 Redis / worker / scheduler。

**Step 2: 识别本次部署所需环境变量**

Run: `rg -n "REDIS_URL|WORKER_CONCURRENCY|DATABASE_URL|NEXTAUTH|SILICONFLOW" src scripts deploy prisma`
Expected: 至少确认 `REDIS_URL`、`WORKER_CONCURRENCY`、`DATABASE_URL`、`NEXTAUTH_*`、`SILICONFLOW_*` 需要被正确注入。

**Step 3: 明确部署验收指标**

Run: `sed -n '1,260p' docs/server_optimize.md`
Expected: 包含 Redis、课堂服务优化、数据治理状态与部署建议。

### Task 2: 补齐服务器部署脚本

**Files:**
- Modify: `deploy/podman/deploy.sh`
- Modify: `deploy/podman/configure-service.sh`
- Modify: `scripts/remote-deploy.sh`

**Step 1: 为远端部署脚本增加 Redis / worker / scheduler 编排**

Implementation:
- `deploy.sh` 新增 Redis 容器、worker 容器、scheduler 一次性任务或常驻容器的编排。
- 将 `REDIS_URL=redis://<redis-container>:6379` 注入 app/worker/scheduler。
- 将 `WORKER_CONCURRENCY` 等 worker 参数从 `.env.server` 透传。

**Step 2: 让 systemd 服务管理完整栈**

Implementation:
- `configure-service.sh` 的 `ExecStart/ExecStop` 覆盖 db、redis、app、worker。
- 保留数据库就绪等待，并增加 Redis 可达性等待。

**Step 3: 扩展远端校验**

Implementation:
- `remote-deploy.sh` 校验 Redis / worker / scheduler 状态。
- 校验 app 容器环境变量中带有 `REDIS_URL`。
- 校验 Redis `PING`、BullMQ key、worker 日志、数据治理状态接口。

### Task 3: 执行服务器部署

**Files:**
- Runtime only

**Step 1: 本地构建并上传镜像**

Run: `bash scripts/remote-deploy.sh`
Expected: 镜像构建、上传、远端执行一键部署。

**Step 2: 核对远端环境变量与容器**

Run: `ssh <target> "podman inspect ..."`
Expected: app / worker / scheduler / redis / db 的关键环境变量与网络连接均正确。

**Step 3: 核对 systemd 与 Nginx**

Run: `ssh <target> "systemctl status act-obe-stack.service nginx"`
Expected: 服务 active，公网入口恢复。

### Task 4: 功能验收

**Files:**
- Runtime only

**Step 1: 验证课堂服务优化链路**

Checks:
- `/api/session/[sessionId]` Redis 快路径可用
- Redis presence / publish-subscribe 可用
- 公网认证会话接口可用

**Step 2: 验证数据治理链路**

Checks:
- Redis 中存在 BullMQ 队列 key
- worker 日志显示消费或监听状态
- 管理员数据治理状态接口返回健康数据
- 至少一条 snapshot / learning fact / queue metric 可被读取

**Step 3: 记录结果**

Implementation:
- 更新 `docs/ProjectDescription.md` 中部署状态说明。
- 输出未完成项、风险项与后续建议。
