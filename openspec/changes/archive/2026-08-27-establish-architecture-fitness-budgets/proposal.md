## Why

前置 baseline、charter 和 domain dependency contract 已识别依赖循环、跨域 deep import、`feature -> app`、中心节点、超大文件和编译资源等结构性风险，但如果没有有依据、单调、可审计的 fitness budget，后续改动仍可通过任意固定阈值或临时例外继续增长。需要把“只减不增”变成可验证的工程控制，同时允许有证据的合理代码演进。

## What Changes

- 消费 `enforce-modular-domain-dependency-contracts` 的唯一依赖图、SCC、deep-import、allowlist 与 owner 记录，不创建第二套 graph authority。
- 建立架构 fitness ledger，覆盖依赖/SCC、跨域 deep import、feature→app、`src/lib` freeze、文件尺寸、编译内存和中心节点变化原因等指标。
- 每项 budget 绑定 qualified baseline/receipt、source revision、scope、metric、当前值、方向、owner、例外理由、删除条件和后续 change；allowlist/例外只允许收敛，不得扩大。
- 任何新 forbidden edge、SCC member、deep import 或冻结指标增长均无条件失败；不得通过新增 exception、扩大 pattern 或补字段绕过，例外集合只能通过删除或合规替换收缩。
- 将 cold RSS/time 等变量 measurement 与 deterministic source-derived budget 分离；不因任意固定阈值阻断有证据的合理实现，也不以增加 heap 伪造改进。
- 输出确定、稳定排序、可从 baseline/graph/receipt 重放的 fitness report，并将未归属或无证据的新增债务 fail closed。

## Capabilities

### New Capabilities

- `establish-architecture-fitness-budgets`: 定义结构依赖、复杂度中心和编译资源预算的证据、例外与单调门禁。

### Modified Capabilities

None. `modular-domain-dependency-contracts` and `split-production-tooling-test-typescript-graphs` are consumed as upstream contracts.

## Impact

- 影响架构 fitness 命令、budget ledger、依赖/TS graph report、文件/中心节点扫描、CI/local verification 和架构文档/receipts。
- 依赖前置 baseline、charter、domain dependency contract 与 production/tooling/test graph identity；不改变产品运行时或生产 selector。
- 不迁移所有历史模块、不删除非本 change 的实现、不创建新 workspace 或第二套 quality authority。

## Dependencies and Blockers

- 硬前置：已 qualified 的 `enforce-modular-domain-dependency-contracts` 与 `split-production-tooling-test-typescript-graphs`；任一 graph/allowlist/owner identity drift 或分母未闭合时，fitness 只能保持 blocked。
- 输入：`capture-modular-monolith-refactor-baseline`、`establish-modular-monolith-refactor-charter`；缺少依据的文件尺寸、中心节点或编译预算必须是 observed/unresolved，不得补写任意阈值。
- qualified fitness report、remaining debt 和 exception ledger 是 `enforce-pr-integration-quality-gates` 的必需输入。
