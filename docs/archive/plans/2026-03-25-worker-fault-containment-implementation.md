# Worker Fault Containment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复数据治理 worker 在 Redis/BullMQ 基础设施异常时无限刷日志的问题，并同步把调度与历史任务保留策略收缩到适合双核 8G 服务器的运行方式。

**Architecture:** 本轮只处理运行可靠性，不处理 `runtime` 课程资源映射问题。实现分四块：worker 侧基础设施故障熔断与冷却、scheduler 改为“夜间批处理 + 白天活跃学生小时级刷新”、BullMQ 历史任务保留收口、Redis 默认容量上调。

**Tech Stack:** Next.js 14, TypeScript, Prisma, Redis, BullMQ, Podman, systemd

### Task 1: 为数据治理 worker 建立故障收敛机制

**Files:**
- Modify: `scripts/workers/data-governance-worker.ts`
- Test: `scripts/tests/test-data-governance-worker-guardrails.mjs`

**Step 1: 写失败测试**

Test assertions:
- worker 文件必须包含冷却文件常量
- 必须存在基础设施错误识别逻辑
- 必须对 `unhandledRejection` / `uncaughtException` 建立收敛处理
- 必须对 worker 失败日志做节流/聚合

**Step 2: 运行测试并确认失败**

Run: `node scripts/tests/test-data-governance-worker-guardrails.mjs`
Expected: FAIL，提示缺少冷却/熔断/日志限流守卫。

**Step 3: 最小实现**

Implementation:
- 增加基础设施错误识别函数，重点识别 Redis `OOM command not allowed`、连接中断、只读等错误
- 增加日志节流函数，同类错误按窗口聚合
- 增加冷却文件，worker 在命中基础设施异常后写入冷却截止时间并退出
- 进程启动时若仍处于冷却期，则等待冷却结束后再真正创建 worker

**Step 4: 运行测试并确认通过**

Run: `node scripts/tests/test-data-governance-worker-guardrails.mjs`
Expected: PASS

### Task 2: 改写 scheduler 为低压运行模式

**Files:**
- Modify: `scripts/workers/scheduler.ts`
- Modify: `scripts/workers/data-governance-worker.ts`
- Test: `scripts/tests/test-data-governance-scheduling-contract.mjs`

**Step 1: 写失败测试**

Test assertions:
- 不再保留 `*/5 * * * *` 的白天 `event-ingestion`
- 活跃学生快照为每小时一次
- 班级快照为每天一次
- 不再出现 `take: 100` 后逐个学生注册 repeatable job

**Step 2: 运行测试并确认失败**

Run: `node scripts/tests/test-data-governance-scheduling-contract.mjs`
Expected: FAIL

**Step 3: 最小实现**

Implementation:
- scheduler 改为三个 coordinator 型 repeatable jobs：
  - 夜间 event ingestion
  - 白天活跃学生快照
  - 夜间班级快照
- student/class worker 支持 coordinator job，在运行时派发 one-off jobs
- 活跃学生判定先基于最近 90 分钟 `InteractionLog` 与 `LearningFact`

**Step 4: 运行测试并确认通过**

Run: `node scripts/tests/test-data-governance-scheduling-contract.mjs`
Expected: PASS

### Task 3: 收紧 BullMQ 历史任务保留

**Files:**
- Modify: `src/lib/data-governance/worker-client.ts`
- Modify: `scripts/workers/scheduler.ts`
- Test: `scripts/tests/test-data-governance-scheduling-contract.mjs`

**Step 1: 为 one-off 与 coordinator job 增加保留策略**

Implementation:
- 统一添加 `removeOnComplete`
- 统一添加 `removeOnFail`

**Step 2: 运行测试确认契约存在**

Run: `node scripts/tests/test-data-governance-scheduling-contract.mjs`
Expected: PASS

### Task 4: 提高 Redis 默认容量并补部署守卫

**Files:**
- Modify: `deploy/podman/deploy.sh`
- Modify: `deploy/podman/configure-service.sh`
- Test: `scripts/tests/test-data-governance-deploy-guardrails.mjs`

**Step 1: 写失败测试**

Test assertions:
- 默认 `REDIS_MAXMEMORY` 为 `512mb`
- systemd 启动脚本仍会等待 Redis 可用
- 远端部署配置保留 worker 容器验收

**Step 2: 运行测试并确认失败**

Run: `node scripts/tests/test-data-governance-deploy-guardrails.mjs`
Expected: FAIL

**Step 3: 最小实现**

Implementation:
- 将 Redis 默认值改为 `512mb`
- 保留 `noeviction`
- 不在本轮改 `runtime` 资源相关逻辑

**Step 4: 运行测试并确认通过**

Run: `node scripts/tests/test-data-governance-deploy-guardrails.mjs`
Expected: PASS

### Task 5: 总体验证

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行守卫测试**

Run:
- `node scripts/tests/test-data-governance-worker-guardrails.mjs`
- `node scripts/tests/test-data-governance-scheduling-contract.mjs`
- `node scripts/tests/test-data-governance-deploy-guardrails.mjs`

Expected: 全部 PASS

**Step 2: 运行 lint**

Run: `npm run lint`
Expected: 通过；若失败，修到通过为止

**Step 3: 更新项目说明**

Implementation:
- 在 `docs/ProjectDescription.md` 记录本轮 worker 熔断、调度收缩和 Redis 默认值调整

**Step 4: 记录未处理项**

Must note:
- `runtime` 课程资源映射问题明确暂缓，等待资源补齐后再处理
