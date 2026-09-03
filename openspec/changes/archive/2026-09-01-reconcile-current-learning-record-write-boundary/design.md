## Context

当前修订为 `957f367026d6d247ef79df2be081debe5c40a617`。仓库已有版本化 event contract、`ingestLearningFact`、staging/outbox 和 projection trigger，但实际写入仍分布在 interactive events、data-governance worker、Assessment、Arena、Personalization 以及历史脚本。审计已确认 API direct path 与 Redis secondary worker 存在重复物化风险，Redis list 也不是 durable inbox；这些事实需要先形成当前修订的闭合分母。

## Goals / Non-Goals

**Goals:**

- 以现有 event registry 和 canonical ingestion API 为唯一协议/应用边界。
- 对每个逻辑 producer 给出可信 owner、transport、幂等键、来源锚点、时间可信度、隐私分类和删除条件。
- 证明 direct、outbox、correction、replay 与 backfill 的语义分流，并消除已证明的同义双写。
- 让后续 C6/C7 能以可审计的 writer contract 迁移到 Assessment、Personalization、Arena 和 Teacher owner。

**Non-Goals:**

- 不增加事件版本、通用 payload 或第二个 Learning Record writer。
- 不把每个内部领域调用事件化，也不把所有活动日志改写为 LearningFact。
- 不改变评分、mastery、画像、推荐、Arena 官方结果或 Teacher 报告的业务规则。

## Decisions

### 1. 保留既有 contract 与 canonical application boundary

`learning-record-event-contract` 继续负责 discriminator、版本、来源、隐私和兼容策略；现有 canonical ingestion/write boundary 继续负责归一化、可信校验、身份、dedupe、持久化和 trigger。选择“在既有边界上核对”而不是创建新 contract，避免两个协议对同一事实给出不同 anchor 或 retention。C5 记录仍未迁移的领域 writer 例外，由 C6/C7 处理，不在此变更伪造完成迁移。

内部同事务 use case 直接调用既有 typed application/write boundary，不为满足事件字典而产生重复事件。跨进程调用只能先进入既有 staging/outbox，再由 worker 调同一 canonical boundary。

### 2. 用 transport 分类而不是按目录命名推断 owner

清单的最小记录为：逻辑 producer、实际入口、owner、direct/staged/correction/replay/backfill 类型、稳定 dedupe identity、source anchors、trusted/server times、privacy class、projection trigger、consumer、测试和 deletion condition。`src/lib/data-governance` 中的文件名不自动意味着 Learning Record owner。

同一业务动作若同时走 direct 与 worker，保留一个权威路径；另一条要么删除，要么登记为只读/审计例外。不能依赖数据库唯一约束长期掩盖双写。

### 3. Backfill 只进入显式历史操作

历史脚本使用冻结输入、授权 operation reference、显式 run identity 和原始 anchor；它们可以通过 canonical writer 产生追加式 correction/rematerialization，但不得隐式更新 online current pointer、冒充实时触发器或改变事实身份。未完成 dry-run、digest、retention 或权限检查的脚本保持不可执行。

### 4. 先建立 characterization，再删除重复入口

在改动前固定成功、duplicate、collision、retryable、terminal、clock-skew、forbidden-field、cross-revision、out-of-order、crash-before-ack 和 direct/outbox 同义输入的结果、错误分类、side effects、digest、anchors 和 watermark。只有零 required caller、替代路径 parity 和回滚证据都成立，才删除重复 writer。

## Risks / Trade-offs

- [Risk] 动态导入或脚本相对调用遗漏在静态清单之外。→ 将运行入口、worker 调度、脚本、测试和字符串命令一起纳入 denominator，并以 all-path canary 复验。
- [Risk] 立即把所有事件改成 outbox 会增加延迟或改变同事务语义。→ 只跨进程使用 staging；已有同事务 Assessment 等路径保持同步 typed call。
- [Risk] 数据库唯一键把重复写入伪装成安全。→ 测试稳定 dedupe identity 的并发行为，并把重复调用本身作为失败证据。
- [Risk] 历史工具污染 online projection。→ 运行态隔离 backfill mode、current-pointer guard、watermark/fence 负例和显式回滚。

## Migration Plan

1. 从 C0 的当前 HEAD capture 接收 owner、调用者和 active-change 冲突证据，生成 producer denominator。
2. 为每个入口补齐 typed boundary 与 direct/outbox/backfill characterization，不改业务语义。
3. 删除或隔离已证明重复的 writer，保留未知、外部或审计入口并标注原因。
4. 运行 focused data-governance/route/worker/Prisma tests、typecheck、strict OpenSpec 和静态零双写扫描。

回滚只恢复先前的代码路径或 qualified projection pointer；不得恢复第二套协议、破坏性 Redis pop、宽泛 raw payload 或覆盖历史事实。

## Open Questions

- C0 需要确认每个 `EvidenceOutbox` producer 的实际 consumer/lease/retry 语义以及未注册动态入口。
- 仅在上述证据闭合后，C6/C7 才能确定各 adapter 的精确 deletion set；本 change 不预先猜测文件删除名单。
