## Context

前置 `capture-modular-monolith-refactor-baseline` 提供 revision-bound 的依赖边、SCC、中心文件、文件尺寸与编译 measurement；`establish-modular-monolith-refactor-charter` 提供唯一 owner、hard/contract/soft/removable 分类；`enforce-modular-domain-dependency-contracts` 将依赖图和既有违规变成只减不增的 allowlist；`split-production-tooling-test-typescript-graphs` 提供 production/tooling/test graph 和测量 receipt。本 change 负责把这些输入投影为一套可执行的 fitness budget，而不是重新扫描并产生平行真源。

## Hard Dependencies

已 qualified 的 `enforce-modular-domain-dependency-contracts` 与 `split-production-tooling-test-typescript-graphs` 是本 change 的硬前置；任一 graph、allowlist、owner 或 receipt drift/分母不完整时保持 blocked。前置 baseline 与 charter 仅作为上游输入，不在本 change 形成回指依赖。

## Goals / Non-Goals

**Goals:**

- 统一报告依赖边、SCC、跨域 deep import、feature→app、中心节点、文件尺寸和编译资源变化。
- 以 baseline 和 frozen receipt 建立有依据的单调预算；既有例外可追责、可删除、可验证，但本 change 不允许新增例外。
- 使报告确定、审计友好，区分 source-derived 事实与环境敏感 measurement。
- 不用任意静态阈值制造门禁；但任何已冻结指标增长都无条件失败，合理代码必须通过合规替换/拆分或另行授权的 baseline revision 解决，而非新增例外。

**Non-Goals:**

- 不复制 domain dependency graph、owner catalog、测试发现或 TypeScript graph authority。
- 不把任意文件大小、行数、RSS 或中心性阈值直接升级为无证据的 P0 gate。
- 不在本 change 中迁移 legacy domain、删除现有大文件、改变产品行为或重写所有 imports。
- 不用 heap 增加、脚本重试、隐藏路径或生成快照替代结构性证据。

## Decisions

### 1. 输入只来自既有 qualified identities

fitness evaluator 接收 baseline、charter、dependency-contract、TS graph 和命令 receipt 的精确 identity。依赖/SCC/deep-import 直接复用 domain contract 的 graph 与 allowlist；production/tooling/test scope 直接复用 TS graph manifest。发现 identity drift、缺少分母或混用 worktree 时 fail closed。

### 2. 统一 budget record schema

每条预算记录包含 `budgetId`、`metricKind`、`scope`、`baselineIdentity`、`sourceRevision/tree`、`observedValue`、`direction`、`owner`、`evidenceRefs`、`exceptionState`、`deletionCondition`、`followUpChange` 和 `status`。记录同时保存 included/excluded/unresolved totals，防止只报一个漂亮总数而丢失分母。

### 3. 按指标性质使用不同的单调规则

依赖违规、跨域 SCC、deep import、feature→app、无 owner 例外、文件尺寸、中心节点和其他冻结指标以 baseline/ledger 为分母，任何新增项或增长都无条件阻断。不得通过新增 exception、扩大 pattern、补充字段、改名或转移 owner 绕过；例外集合只能因删除或合规替换而减少。编译 RSS/time 只消费 source/command-bound measurement receipt，使用可解释的趋势或显式预算记录；若某个已冻结 budget metric 增长，必须失败，不能把一次机器峰值硬编码成新的跨环境真理。

### 4. 例外集合只能收缩，不是新权威

既有例外必须说明受保护事实、必要性、owner、消费者、风险、后续 change、删除条件和验证命令；本 change 只允许删除例外，或以合规替换删除原例外，不允许新增记录、扩大 glob/pattern、放宽层级、补字段或覆盖未来身份。没有完整证据的既有例外保持 blocked，不能用新记录补齐。

### 5. 结果可重放且分层呈现

deterministic report 由稳定排序的 graph edges、SCC members、file identities、budget records 和 frozen receipt IDs 生成；环境变量只在 measurement section 展示。报告明确 `qualified`、`blocked`、`observed`、`unresolved`，不会把历史 baseline 或未完成迁移写成当前合规。

## Risks / Trade-offs

- [Risk] 大型 legacy graph 使首次 report 大量 blocked/observed。→ 只对新增或未登记项阻断，保留已有 allowlist/ledger 的 owner 与删除条件。
- [Risk] 文件大小/中心性指标会阻断合理集中入口的增长。→ 不用任意阈值作为权威；要求通过合规拆分/替换保持冻结指标不增长，必要的 baseline 重定义必须在另行授权的上游变更中完成，本 change 不新增例外。
- [Risk] RSS/time 跨机器抖动。→ receipt 与 deterministic core 分离，预算只引用明确的 measurement identity 和 scope。
- [Risk] 多个工具重新生成 graph。→ 以 domain contract 和 TS graph 的 identity 校验输入，任何第二套发现结果报告 drift。

## Migration Plan

1. 锁定 baseline、charter、dependency contract 与 TS graph identity，确认目录/branch 干净且未混合 capture。
2. 定义 budget record、metric evaluator、例外 ledger、稳定 report 和 drift/denominator validator。
3. 在不迁移 legacy 代码的前提下，先报告现有 debt，再对任何新依赖/SCC/deep-import/冻结指标增长无条件失败；既有例外只能删除或由合规替换收缩。
4. 生成文件尺寸、中心节点和编译 measurement projections，保存 owner/delete-condition 记录。
5. 运行 fitness fixtures、依赖 contract、各类 typecheck、受影响领域测试、strict validation；不部署、不 claim、不激活。

## Open Questions

无。具体预算值必须来自 qualified baseline 与可复核 evidence；缺少依据时保持 observed/unresolved，而不是写入任意阈值。
