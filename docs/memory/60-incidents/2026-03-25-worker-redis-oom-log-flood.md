# 2026-03-25 worker 因 Redis OOM 触发日志风暴

状态: active
最后更新: 2026-03-25
摘要: 记录生产环境 `act-obe-worker` 因 Redis `maxmemory` 命中后持续报错、最终把 stopped container 的 `ctr.log` 刷到约 16GB 的事故。根因不是单纯“调度过频”，而是 worker 在基础设施异常下没有冷却、自我收敛和日志限流，scheduler 也持续制造高频任务与历史堆积。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [../30-operations/50-known-deploy-risks.md](../30-operations/50-known-deploy-risks.md)
- [../30-operations/30-database-and-migrations.md](../30-operations/30-database-and-migrations.md)
- [../../docs/archive/plans/2026-03-25-worker-fault-containment-implementation.md](../../archive/plans/2026-03-25-worker-fault-containment-implementation.md)

## 结论

- 这次事故的直接表现是 `act-obe-worker` 容器日志爆炸，占满服务器磁盘；直接来源是容器 `ctr.log`，不是数据库体积，也不是镜像层异常
- 触发链条是 Redis 达到 `maxmemory` 后返回 `OOM command not allowed`，worker 持续重试并重复打印同类错误；即使容器停止，日志文件仍保留在 Podman 容器存储目录中，因此磁盘不会自动回收
- 根因分两层：
  - 负载层：旧 scheduler 白天高频调度，尤其 `snapshot-student` repeatable jobs 和历史保留过多，持续向 Redis 堆积压力
  - 故障模式层：worker 对 Redis/BullMQ 基础设施异常没有熔断、冷却、日志节流和未捕获异常收敛，导致异常进入“无限刷日志”模式
- 根治思路不能只靠“降频”和“加大 Redis 容量”；必须同时修复 worker 的异常自收敛能力

## 关键事实

- 事故发生时，远端 stopped `act-obe-worker` 的 `ctr.log` 约为 16GB，导致服务器空间异常逼近上限
- 白天旧调度策略是：
  - `event-ingestion`: 每 5 分钟
  - `snapshot-student`: 每 10 分钟
  - `snapshot-class`: 每 15 分钟
- 更严重的问题是旧 `scheduler.ts` 会对最多 `100` 个学生逐个注册 repeatable jobs，而不是注册少量 coordinator jobs 后按需派发 one-off jobs
- 线上观察到 `snapshot-student` 队列历史很大，是 Redis 撑爆的主因之一
- 用户给出的目标运行策略已经明确：
  - 白天以课堂数据收集为主，不做实时分析
  - 活跃学生快照每小时一次
  - 班级快照每天一次
  - 二次事件批处理放到凌晨

## 证据

- 线上排查确认最大空间来源是 `act-obe-worker` 容器日志文件，而不是数据库数据卷
- 停掉容器后磁盘空间没有立即释放，说明问题文件仍在容器存储目录；删除 stopped 容器后，磁盘用量从约 `93%` 回落到约 `61%`
- 守卫测试在修复前分别验证出以下缺口：
  - worker 缺 `COOLDOWN_FILE`
  - worker 缺 Redis/BullMQ 基础设施错误识别
  - worker 缺 `unhandledRejection` / `uncaughtException` 收敛
  - scheduler 仍对 `100` 个学生逐个注册 repeatable jobs
  - `worker-client` 缺 `removeOnComplete/removeOnFail`
- 修复后，以下验证均已通过：
  - `node scripts/tests/test-data-governance-worker-guardrails.mjs`
  - `node scripts/tests/test-data-governance-scheduling-contract.mjs`
  - `node scripts/tests/test-data-governance-deploy-guardrails.mjs`
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## 已落地修复

- `scripts/workers/data-governance-worker.ts`
  - 启动前读取冷却文件，若仍在冷却期则等待
  - 显式识别 Redis/BullMQ 基础设施异常
  - 对同类错误做窗口化日志节流与聚合
  - 命中基础设施异常后写入冷却文件并优雅退出
  - 增加 `unhandledRejection` / `uncaughtException` 兜底收敛
- `scripts/workers/scheduler.ts`
  - 改为 coordinator 调度
  - 不再对白天高频逐学生注册 repeatable jobs
  - 当前运行节奏改为：
    - 凌晨事件批处理
    - 每小时活跃学生快照
    - 每天一次班级快照
- `src/lib/data-governance/worker-client.ts`
  - 统一增加 `removeOnComplete` 和 `removeOnFail`
- `deploy/podman/deploy.sh`
  - 默认 `REDIS_MAXMEMORY` 调整到 `512mb`
  - 保持 `REDIS_MAXMEMORY_POLICY=noeviction`

## 处置经验

- 磁盘被 Podman 日志挤爆时，先找最大 `ctr.log`；单纯 `podman stop` 通常不能回收空间
- 需要区分“止血”和“根治”：
  - 止血：截断日志或删除 stopped 容器，临时上调 Redis 内存
  - 根治：减少白天非必要处理、限制 BullMQ 历史保留、增加 worker 熔断和冷却
- 若再次看到 Redis `OOM command not allowed`，优先检查：
  - `snapshot-student` 队列是否重新出现历史堆积
  - scheduler 是否被回滚成高频 repeatable jobs
  - worker 是否还具备冷却文件和日志节流逻辑

## 后续提醒

- `runtime` 课程资源映射问题与本事故无关，本轮已明确暂缓，不要和 worker 故障混在同一次修复里
- 若未来把事件批处理再次改回白天高频运行，必须同步重新评估 Redis 容量、BullMQ 历史保留和 worker 冷却策略
- 如果线上再次出现 worker 容器频繁重启但业务日志内容高度重复，应优先把它判断为“故障收敛缺失”而不是单纯业务 bug
