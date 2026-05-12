# Data Governance Scheduling Capacity Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在双核 8G 服务器约束下，重构数据治理的事件收集、快照刷新与夜间批处理调度，保证白天课堂阶段稳定收集事件、避免 Redis/worker 再次打满，并把分析压力转移到凌晨窗口。

**Architecture:** 保留“核心事件直达 PostgreSQL、次级事件先进 Redis 缓冲”的总体思路，但取消白天高频批处理和全量学生重复快照任务；改为白天只做低压收集与“活跃学生小时级刷新”，夜间集中执行次级事件批量处理与班级快照刷新。BullMQ 从“每个学生一个 repeatable job”改成“少量 coordinator repeatable job + 批量派发 one-off job”，并严格限制历史任务保留量。

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, Redis, BullMQ, Podman, systemd

## 背景与问题陈述

### 当前链路

1. **核心事件**
   - 例如 `lesson_submit`、`lesson_resubmit`、`session_finalize`
   - 由 [src/app/api/interactive/events/route.ts](../../src/app/api/interactive/events/route.ts) 路由到 PostgreSQL
   - 经 [src/lib/event-queue.ts](../../src/lib/event-queue.ts) 以 `3 秒 / 100 条` 批量落库

2. **次级事件**
   - 例如 `page_view`、`lesson_step_view`、`lesson_step_leave`、`workspace_param_change`
   - 先进入 [src/lib/data-governance/event-buffer.ts](../../src/lib/data-governance/event-buffer.ts) 的 Redis 缓冲区
   - 再由 [scripts/workers/data-governance-worker.ts](../../scripts/workers/data-governance-worker.ts) 的 `event-ingestion` worker 每 `5` 分钟取最多 `100` 条处理

3. **快照刷新**
   - [scripts/workers/scheduler.ts](../../scripts/workers/scheduler.ts) 当前会注册：
   - `event-ingestion`: 1 条 repeatable，`*/5 * * * *`
   - `snapshot-student`: 100 条 repeatable，`*/10 * * * *`
   - `snapshot-class`: 按班级数注册 repeatable，当前线上为 5 条，`*/15 * * * *`

### 已暴露的问题

1. **Redis maxmemory 过小**
   - 部署默认值为 `128mb`，见 [deploy/podman/deploy.sh](../../deploy/podman/deploy.sh)
   - 在线上已经证明不足以承载当前 BullMQ 历史任务和缓冲数据

2. **白天分析任务过密**
   - 课堂阶段只要求“及时收集并记录”，并不要求实时分析
   - 当前却在白天高频运行学生快照和事件 ingestion，消耗 Redis、CPU 与日志空间

3. **repeatable jobs 粒度过细**
   - 当前为每个学生单独注册 repeatable job
   - 导致 Redis 中 `bull:snapshot-student:*` 元数据和 `completed/failed/events` 历史膨胀

4. **次级事件 ingestion 吞吐量严重不足**
   - 当前只有 `100 / 5 分钟 = 20 条/分钟`
   - 对课堂期次级事件流量而言明显不够

## 运行原则

本改造以以下原则为真值来源：

1. **白天优先保证课堂稳定**
   - 课堂期间只要求事件可靠进入 Redis / PostgreSQL
   - 不要求次级事件实时分析

2. **Redis 的职责是削峰填谷**
   - 它的主要价值是缓解课堂高峰期数据库直连失败
   - 不是白天持续承载大规模 BullMQ 历史任务

3. **学生个人快照只刷新活跃学生**
   - 不再对所有学生做全量轮询刷新
   - 白天按每小时一次刷新即可

4. **班级快照每天一次**
   - 放入凌晨窗口

5. **次级事件批处理放入凌晨**
   - 夜间统一 drain Redis 缓冲并写入 PostgreSQL

## 容量估算与目标

### 当前核心事件吞吐量

app 进程内 `eventQueue` 约为：

- `100 条 / 3 秒`
- 理论上约 `33 条/秒`
- 约 `2000 条/分钟`

该链路主要承载核心课堂提交类事件，当前判断 **基本够用**。

### 当前次级事件吞吐量

当前 `event-ingestion` 约为：

- `100 条 / 5 分钟`
- 即 `20 条/分钟`
- 即 `1200 条/小时`

该链路对白天课堂阶段 **明显不够**，因此不应再试图用白天小批量 ingestion 跟上课堂实时流量，而应改成“白天缓冲、夜间处理”。

### 白天次级事件容量目标

按双核 8G 和精品课堂页面交互模式，采用保守容量假设：

- 正常课堂：40 名学生，次级事件 `3~6 条/人/分钟`
- 课堂总量：`120~240 条/分钟`
- 2 小时课堂总量：`14400~28800 条`
- 4 小时连续高峰教学日：`28800~57600 条`

若叠加课后自学和异常峰值，建议白天缓冲按 **至少 150000 条次级事件** 设计，而不是当前的 `10000` 条。

### Redis 内存建议

在双核 8G 机器上，建议目标配置：

- `REDIS_MAXMEMORY=512mb` 作为新默认值
- 若事件样本平均体积明显偏大，再评估提高到 `768mb`
- 保持 `noeviction`

原因：

1. 本项目 Redis 不只是课堂状态，还承载次级事件缓冲与少量 BullMQ 元数据
2. 只要严格清理 BullMQ 历史任务，`512mb` 对双核 8G 服务器仍是可接受占用
3. `noeviction` 能避免课堂高峰时出现静默淘汰关键键

## 目标调度方案

### 白天窗口

#### 1. 核心事件

- 保持现有模式
- 继续走 app 内 `eventQueue`
- 不经过夜间批处理链路

#### 2. 次级事件

- 继续写入 Redis 缓冲
- **白天不做固定每 5 分钟 ingestion**
- Redis 只负责“暂存并抗压”

#### 3. 活跃学生快照

- 每小时执行 1 次 coordinator
- coordinator 只筛选“最近 90 分钟内活跃”的学生
- 为活跃学生派发 one-off `snapshot-student` 任务
- 不再为 100 个学生分别注册 repeatable jobs

推荐时间：

- `15 * * * *`

说明：

- 例如每小时 `:15` 执行一次，避开整点业务高峰
- “活跃”定义建议按最近 90 分钟命中任一条件：
  - 产生过核心事件
  - 产生过次级事件
  - 在课堂 `presence` 中仍在线
  - 最近有新的 `LearningFact` 或 `InteractionLog`

### 夜间窗口

#### 1. 次级事件批量处理

- 每天凌晨启动一次“drain until empty”的批处理任务
- 按较大批量循环读取 Redis 缓冲，直到清空或达到时间上限
- 不再使用“每 5 分钟只吃 100 条”的模式

推荐时间：

- `01:00` 启动夜间 ingestion coordinator
- 必要时 `04:00` 再做一次补偿扫描

#### 2. 班级快照刷新

- 每天 1 次即可
- 放在次级事件批处理之后

推荐时间：

- `03:30`

### Repeatable Jobs 目标数量

改造后，线上长期存在的 repeatable jobs 应收缩为：

1. `student-snapshot-coordinator`：1 条，每小时一次
2. `nightly-event-ingestion-coordinator`：1 条，每天一次
3. `class-snapshot-coordinator`：1 条，每天一次

总计：**3 条**

而不是当前的：

- `event-ingestion`: 1 条
- `snapshot-student`: 100 条
- `snapshot-class`: 5 条

## 具体改造任务

### Task 1: 收缩白天调度职责

**Files:**
- Modify: `scripts/workers/scheduler.ts`
- Modify: `scripts/workers/data-governance-worker.ts`
- Modify: `src/lib/data-governance/worker-client.ts`
- Modify: `docs/ProjectDescription.md`

**Step 1: 移除白天固定 5 分钟 ingestion 调度**

Implementation:
- 删除 `EVENT_INGESTION: '*/5 * * * *'` 的白天 repeat 调度
- 改为夜间 coordinator 型调度

**Step 2: 把学生快照从“每个学生一个 repeatable”改成“单一 coordinator”**

Implementation:
- scheduler 不再对 `take(100)` 的学生逐个 `add(repeat...)`
- 改为每小时 1 次调度 coordinator job
- coordinator 在运行时查询活跃学生并派发 one-off jobs

**Step 3: 把班级快照改成单一 nightly coordinator**

Implementation:
- scheduler 不再对每个班级逐个 `add(repeat...)`
- 每天 1 次调度 class coordinator
- coordinator 在任务体内按班级列表依次派发或串行执行

### Task 2: 放大 Redis 缓冲，但限制其职责

**Files:**
- Modify: `deploy/podman/deploy.sh`
- Modify: `podman-compose.yml`
- Modify: `src/lib/data-governance/event-buffer.ts`

**Step 1: 调整 Redis 默认内存上限**

Implementation:
- 将默认 `REDIS_MAXMEMORY` 从 `128mb` 调整为 `512mb`
- 保持 `REDIS_MAXMEMORY_POLICY=noeviction`

**Step 2: 提高次级事件白天缓冲上限**

Implementation:
- 当前 `LTRIM 0..9999` 改为更大的安全值，例如 `149999`
- TTL 可维持 `48 小时` 到 `72 小时`

**Step 3: 为日统计补充 backlog 观测**

Implementation:
- 记录每日 `buffered / processed / remaining / dropped`
- 让运营侧能看出当天夜间任务是否完成 drain

### Task 3: 把夜间 ingestion 改成 drain-until-empty

**Files:**
- Modify: `scripts/workers/data-governance-worker.ts`
- Create: `scripts/workers/nightly-event-ingestion.ts` 或等价模块
- Modify: `src/lib/data-governance/event-buffer.ts`

**Step 1: 将单次读取批量从 100 提升到夜间专用批量**

Implementation:
- 白天不跑 ingestion
- 夜间 ingestion 改为循环处理，例如每轮 `500` 或 `1000` 条
- 持续拉取直到缓冲为空

**Step 2: 设置夜间执行保护**

Implementation:
- 增加最大运行时长，例如 `2~3 小时`
- 增加每轮 sleep / backpressure 开关，避免长事务压垮数据库

**Step 3: 明确事实沉淀边界**

Implementation:
- 核心事件仍实时直达 PostgreSQL
- 次级事件夜间只落 `LearningEventBatch`
- 如需二次转事实，明确哪些次级事件真的有事实价值，避免重复筛 `isCoreEvent`

### Task 4: 收紧 BullMQ 历史保留

**Files:**
- Modify: `src/lib/data-governance/worker-client.ts`
- Modify: `scripts/workers/scheduler.ts`
- Modify: `scripts/workers/data-governance-worker.ts`

**Step 1: 所有 one-off jobs 增加历史保留策略**

Implementation:
- 为 `add(...)` 增加 `removeOnComplete`
- 为 `add(...)` 增加 `removeOnFail`

建议值：
- `removeOnComplete: 100`
- `removeOnFail: 200`

目标：
- Redis 中不再无限累积 `completed / failed / events`

**Step 2: coordinator jobs 也限制历史**

Implementation:
- coordinator 本身同样开启有限保留
- 避免“调度器健康但 Redis 被历史撑爆”

### Task 5: 定义“活跃学生”判定规则

**Files:**
- Create: `src/lib/data-governance/active-student-query.ts`
- Modify: `scripts/workers/data-governance-worker.ts`
- Test: `scripts/tests/` 下新增活跃学生筛选测试

**Step 1: 确定活跃判定窗口**

建议：
- 最近 `90 分钟`

**Step 2: 确定活跃数据来源**

优先顺序：
- `InteractionLog` 最近事件
- `LearningFact` 最近事件
- Redis `presence`
- 正在进行中的课堂 `session`

**Step 3: 避免重复刷新**

Implementation:
- 为同一学生设置最近快照冷却时间，例如 `>= 45 分钟`
- 同一小时内不重复派发同一学生快照

## 频率建议总表

| 任务 | 当前 | 目标 | 说明 |
|------|------|------|------|
| 核心事件落库 | app 内 3 秒批量 | 保持 | 已基本满足课堂需求 |
| 次级事件 ingestion | 每 5 分钟 / 100 条 | 改为每天凌晨 drain | 白天不做实时分析 |
| 学生快照 | 100 个学生每 10 分钟 | 每小时一次，仅活跃学生 | 由 coordinator 动态筛选 |
| 班级快照 | 每 15 分钟 | 每天一次 | 放到凌晨窗口 |
| Redis maxmemory | 128mb | 512mb | 先改默认值，再结合监控调优 |

## 容量与风控判断

### 白天

白天主要压力应变成：

1. 核心事件实时落库
2. 次级事件进入 Redis 缓冲
3. 每小时一次活跃学生快照

这对双核 8G 服务器是可行的，前提是：

- Redis 不再承载大规模 BullMQ 历史
- 次级事件只缓存，不分析
- 学生快照数量与活跃人数绑定，而不是与学生总数绑定

### 夜间

凌晨窗口主要压力变成：

1. drain 次级事件缓冲
2. 生成班级快照
3. 可选地补做学生画像摘要或风险刷新

此时在线课堂压力低，更适合使用 CPU 与数据库资源。

## 验收标准

### 运行侧

1. 线上 repeatable jobs 总数降为 3 条左右
2. Redis `used_memory` 在白天课堂期间不再线性逼近 `maxmemory`
3. stopped worker 不再因为 OOM 刷出超大 `ctr.log`
4. Redis 中 `bull:snapshot-student:completed/failed/events` 不再持续无限增长

### 业务侧

1. 课堂期间核心提交事件仍能稳定记录
2. 次级事件在课堂期间可稳定进入 Redis，不再触发接口失败风暴
3. 活跃学生快照可在 1 小时内更新
4. 班级快照每天可稳定刷新一次
5. 次级事件可在次日完成批处理入库

### 验证命令

Run: `ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli INFO memory | sed -n '1,40p'"`
Expected: 白天 Redis 使用量低于 `maxmemory` 的 70%~80%，且不再快速逼顶。

Run: `ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli --scan --pattern 'bull:*' | wc -l"`
Expected: BullMQ 键数显著低于当前 7 万级。

Run: `ssh root@121.40.124.135 "podman logs --tail 200 act-obe-worker"`
Expected: 不再持续出现 `OOM command not allowed when used memory > 'maxmemory'`。

Run: `ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli ZCARD bull:snapshot-student:repeat"`
Expected: 不再是 100，而是 coordinator 级别的少量 repeat jobs。

## 实施顺序建议

1. 先改部署默认值与 BullMQ 历史保留
2. 再改 scheduler，从多 repeatable jobs 收缩为 coordinator 模式
3. 再改 event buffer 容量与夜间 drain 逻辑
4. 最后补活跃学生筛选与监控指标

## 风险提醒

1. **不要先重启 worker 再改策略**
   - 否则很可能再次把 Redis 顶满

2. **不要在白天直接启用大批量次级事件回放**
   - 会和课堂读写争资源

3. **不要继续保留“每个学生一个 repeatable job”**
   - 这会让 Redis 元数据和历史任务再次持续膨胀
