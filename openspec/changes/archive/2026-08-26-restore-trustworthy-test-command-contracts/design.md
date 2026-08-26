## Context

当前 `package.json` 中 `test` 组合 smart-courseware、smoke、Arena 与 commercial UI 专项脚本，完整 Vitest 由 `test:unit` 单独调用；`vitest.config.ts` 通过多组人工维护的目录 include 选择测试。`.github/workflows/ci.yml` 目前主要覆盖 `main` push 和手动触发，命令与 PR、integration、release 的职责没有形成一一对应的合同。

前置 baseline 已要求测试分母、命令范围、未处理异常和环境敏感结果按 revision 记录。该 change 只建立命令与证据控制面，具体红测修复由 `eliminate-accepted-red-test-baseline` 负责，TypeScript 图拆分由 `split-production-tooling-test-typescript-graphs` 负责。

## Hard Dependencies

`capture-modular-monolith-refactor-baseline` 与已 qualified 的 `establish-modular-monolith-refactor-charter` 是本 change 的两个硬前置。charter 资格不能由 baseline 身份、目录结构或命令结果推定；任一前置缺失、drift 或分母不完整时，本 change 只能保持 blocked。

## Goals / Non-Goals

**Goals:**

- 让每个测试命令有稳定、可读、可被 CI 直接引用的 scope 和失败语义。
- 自动发现声明范围内的领域测试，报告 discovered、classified、excluded、unresolved 分母。
- 让 deterministic test result 与环境敏感 measurement receipt 分离，并绑定 source revision/tree。
- 将 run-specific 发布证据变成显式的 release qualification 输入，而不是默认产品测试的隐式文件依赖。

**Non-Goals:**

- 不在本 change 中修复具体失败测试、重写产品实现或删除已确认失效测试。
- 不创建第二套领域 owner、依赖图或发布 authority；发现结果消费既有 baseline/charter。
- 不以提高 Node heap、重试 flaky 测试或扩宽断言来制造绿色。
- 不修改 GitHub branch protection、部署配置、数据库 schema 或 production selector。

## Decisions

### 1. 采用显式命令矩阵

命令合同固定为：`npm test` 是 PR 默认的快速、确定性、必须全绿集合；`test:unit` 覆盖所有领域纯单元测试；`test:contract` 覆盖 API、事件、manifest、bundle、WASM facade 等边界；`test:integration` 覆盖 PostgreSQL、Redis、worker、repository 与文件系统适配；`test:e2e:critical` 只覆盖关键用户旅程；`test:release` 只消费显式发布资格输入；`test:nightly` 承载全量、视觉、性能和真实 provider smoke。每个命令必须输出自己的 scope 和 receipt，不允许用历史专项脚本集合代替命令语义。

### 2. 以自动发现取代人工 include 表

发现器先从版本控制中的文件集合，依据仓库命名约定和显式排除规则独立枚举 repository-level test universe，再单独枚举声明的测试根、领域 owner 和 layer 分类，最后执行双向集合核对。Vitest 可以使用 glob 或多个配置执行，但任何手工列表只能作为受审计的执行约束，不能成为完整性证明。新目录中的 test 文件即使不在现有声明根中，也必须进入 denominator，并因缺少 root/classification 而失败，不能被忽略。

### 3. 以双层 receipt 保存结果

source-derived 的发现 manifest、测试身份和分类采用确定性序列化；duration、RSS、Node/OS 和外部服务状态等变量放入不可变 measurement receipt。每个 receipt 记录 `schemaVersion`、`sourceRevision`、`sourceTree`、命令 ID、scope、工具版本、cache mode、退出状态、计数、未处理异常和安全的失败 fingerprint。禁止写入凭据、原始事件载荷、学生标识、本机绝对路径或完整日志。

### 4. 发布证据必须显式入参

商业 UI、runtime、知识图谱和 OSS 的 run-specific evidence 不再由 `npm test` 隐式读取。`test:release` 接收具名 qualification manifest，逐项校验其 capture revision/tree、artifact hash、schema 和 freshness；缺失、漂移或只存在于本机的证据使 release qualification 失败。产品行为测试不因发布证据缺失而被改写为通过。

### 5. 失败语义保持 fail closed

mandatory scope 中的 assertion failure、未处理 error、未登记 skip、发现分母缺口、receipt 漂移或 accepted failure 均导致非零退出。命令不得通过 silent exclusion、flaky retry、永久 quarantine 或宽化断言隐藏失败；必要的夜间测试必须拥有独立命令和 owner，而不是混入默认命令的 accepted failure。

## Risks / Trade-offs

- [Risk] 自动发现会暴露当前未归属或长期未运行的测试。→ 先输出 unresolved 分类并阻断 qualification，由后续红基线 change 逐项处置。
- [Risk] 发布证据迁移后 release command 初期缺少输入。→ 让缺失 manifest 明确成为 release blocker，并记录 source revision-bound receipt，不回退到隐式旧路径。
- [Risk] 命令矩阵增加调用者迁移成本。→ 保留原有脚本作为实现组件，先收敛公开入口和 CI 映射，再逐步删除孤立入口。
- [Trade-off] 环境敏感 receipt 无法保证跨机器字节相同。→ 只要求 deterministic core 可重建，measurement 使用冻结 receipt identity，不把一次测量当永久常量。

## Migration Plan

1. 在两个硬前置均 qualified 的前提下，重新核对当前 `package.json`、Vitest、workflow 和测试分母，生成 characterization receipt。
2. 实现命令矩阵、自动 discovery manifest、分类校验和双层 receipt；为新命令添加契约测试。
3. 将 `npm test`、`test:unit` 等旧入口改为上述合同的薄编排层，删除人工 include 作为唯一权威和默认命令中的隐式发布证据读取。
4. 将 run-specific evidence 的发布资格消费交给 `test:release`，把当前红色处置交给依赖 change。
5. 运行命令合同、发现分母、相关领域测试和 strict OpenSpec validation；不部署、不 claim、不改变生产状态。

## Open Questions

无。具体测试归属冲突必须保留为 receipt 中的 unresolved blocker，不能在命令层静默解决。
