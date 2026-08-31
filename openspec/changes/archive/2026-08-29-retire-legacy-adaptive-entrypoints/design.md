## Context

旧 adaptive 入口不是同一种对象：有些是仍有调用者的兼容 API，有些是只转发的文件，有些是进程内 fallback 或 feature flag，还有些 Prisma 表由其他域继续服务。直接按文件名删除会误删共享存储；保留全部入口又会使 canonical Assessment、Personalization 和 Learning Record authority 无法成立。因此删除必须以当前 Git revision、真实 production import graph、调用者迁移证据和 owner ledger 为共同门禁。

## Decisions

### Evidence gate

在删除前生成包含 source path、symbol、owner、生产调用者、EvidenceOutbox producer/consumer、前置 change 状态、替代 public API、测试和 disposition 的 inventory。`openspec validate --strict` 的 artifact 完整不等于实现完成；必须额外证明前置任务、characterization、域测试、跨进程 EvidenceOutbox 协议 qualification 和零生产导入。closed Issue、旧 clearance 或静态文件存在不能单独证明完成。

### Scope of retirement

清理对象包括：

- `src/features/adaptive-learning/kaq-quiz-coverage.ts` 这类仅 re-export 的可证删除入口；
- 已迁移且无生产消费者的 `src/lib/adaptive-*` authority、forwarding/facade 和旧 path/learner/recommendation/attempt exports；
- Assessment persistence、learner-state 等已被 canonical durable path 替代的 fallback helper、disable flag 和 shim。
- 已由新协议替代、且新协议已 qualified、旧 consumer 零生产调用的 EvidenceOutbox consumer；在此之前必须保留并登记，不得以删除 consumer 代替协议迁移。

旧 `Question`/`UserAnswer` 或其他 Prisma 表若仍有明确的非 adaptive owner，则只删除旧 authority/adapters，不删除表或历史数据；不能用隐藏 fallback 继续服务已迁移的 path-owned flow。

### Architecture proof

删除后运行生产源导入扫描、EvidenceOutbox consumer/worker 调用扫描、TypeScript/build dependency scan、架构规则和目标域测试。扫描必须区分测试 fixtures、历史文档和生产代码；任一生产导入、动态 import、re-export、旧 flag reference、未 qualification 的新协议或第二套 authority 均阻断。ledger 记录保留项、删除 SHA、验证命令和 rollback commit。

### Rollback

回滚只允许恢复代码版本并重新执行相同验证，不恢复第二套生产 authority。不可变 Assessment snapshots、LearningFacts、路径历史和旧表数据保持可读；本 change 不做数据删除或生产切换。

## Risks and mitigations

- 隐藏动态导入：结合静态 import graph、build output 和运行入口扫描，并为已知框架生成代码单独登记。
- 错删共享表：按 owner ledger 和真实 callers 判断，仅删除入口，不删除其他域存储。
- 旧 outbox consumer 被提前删除：将新协议的数据库唯一性、worker-only materialization、crash/replay 和隐私投影证据作为独立 deletion gate。
- 前置 change 被错误标记完成：要求当前 SHA 的任务/测试/归档证据，不能以 GitHub closed 或 artifact existence 替代。
