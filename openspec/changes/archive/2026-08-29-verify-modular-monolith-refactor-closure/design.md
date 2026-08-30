## Context

ACT 已经有 revision-bound 的架构 baseline、charter/deprecation ledger、模块依赖 contract，以及正在建立的 fitness、质量、TypeScript/toolchain 和 QA evidence 生命周期。各领域迁移还会分别产生 terminal receipt。它们的局部结论不能直接拼接成全局完成声明：输入可能来自不同 source tree，旧 receipt 可能被新 receipt 取代，排除项和重复项可能没有进入分母，领域也可能只完成了 proposal 或中间阶段。

本 change 是这些工件之上的最后一个验证层。它只读取显式输入 manifest，验证 identity、receipt 新鲜度、分母和 terminal coverage，然后投影一个不可变的规范化 global closure receipt。它不重新扫描依赖、不重算 owner、不重建质量或 QA 状态机，也不写入产品或生产状态。

现有 `scripts/architecture-census.ts`、`scripts/architecture-charter.ts` 和 `scripts/architecture-fitness.ts` 继续分别拥有 census、charter 和 fitness 的职责；它们不是本 change 的替代 aggregator。当前 active proposal 只有在其实现产生合格 receipt 后才能作为输入，proposal 文本、勾选 tasks、Issue closed、archive 目录和历史 receipt 均不能替代 current-revision evidence。

## Hard dependencies and terminal stages

闭合器读取以下类别的唯一权威输入。每条输入都必须带 `receiptId`、`contentDigest`、`schemaVersion`、`sourceCommit`、`sourceTree`、owner、scope 和 status；未合格的 proposal 不计为 receipt。

| input/stage | authority consumed | terminal coverage |
| --- | --- | --- |
| baseline | `modular-monolith-architecture-baseline` | baseline identity and denominator receipt |
| charter | `modular-monolith-refactor-charter` plus its deprecation ledger | owner and compatibility receipt |
| dependency | `modular-domain-dependency-contracts` | graph, reverse-edge, SCC, deep-import and allowlist receipt |
| fitness | `establish-architecture-fitness-budgets` | structural budget report and before/after metrics |
| quality | trustworthy test command/red-baseline/PR quality contracts | command, failure-disposition and quality terminal receipts |
| toolchain | production/tooling/test graph and independent toolchain contracts | one terminal receipt for each required toolchain stage |
| QA | `qa-evidence-artifact-lifecycle` and commercial QA manifests | evidence classification, privacy and retention terminal receipts |
| domain stages | `assessment-personalization-1567`, `course-classroom-1576`, `learning-record-1587`, `knowledge-resource-1592`, `practice-1602`, `assignment-retirement-1607`, `generated-content-reconciliation-1608` | one current terminal receipt per declared stage |

The required terminal stage IDs are stable and explicit: `governance-1548`, `quality-1554`, `toolchain-1557`, `toolchain-1558`, `toolchain-1559`, `assessment-personalization-1567`, `course-classroom-1576`, `learning-record-1587`, `knowledge-resource-1592`, `practice-1602`, `assignment-retirement-1607`, and `generated-content-reconciliation-1608`. The last two map to native child Issues #1607 and #1608. Tracking parent #1603 is coordination metadata only; it is not a terminal receipt and is not a blocker for this stage registry.

## Goals / Non-Goals

**Goals:**

- Consume one qualified source identity and one explicit input manifest; reject dirty, mixed, drifted or stale inputs before qualification.
- Preserve every included, excluded, duplicate and unresolved observation in a closed denominator and retain isolated/main same-path different-content observations as separate records.
- Require exactly one current terminal receipt for every declared stage and map every attachment to that receipt without treating task checkboxes or historical paths as proof.
- Project source/tree identity, input receipt identities, before/after metrics, totals, terminal coverage, remaining compatibility records, blocked records and one of four explicit statuses.
- Make normalized output byte-identical for identical input bytes and safe to publish as a portable, content-addressed receipt.
- Give the quality/review control plane one reader while proving that no alternative aggregator or compatibility façade is an authority.

**Non-Goals:**

- 不新增或重算依赖 graph、owner catalog、deprecation ledger、fitness budget、test inventory、QA lifecycle 或 AI state machine。
- 不执行迁移、删除、claim、archive、部署、production activation、selector 切换、Prisma/数据库写入、事件写入或运行态刷新。
- 不复制 screenshots、logs、HAR、raw answers、learner identifiers、credentials、私有 evidence 或其他原始领域证据；只引用 immutable identity、结论和 totals。
- 不把 receipt 产生解释为全部业务完成；范围外能力仍以其自己的 authority 和 terminal receipt 为准。

## Decisions

### 1. A single canonical input manifest and source identity

命令接收一个显式 manifest，而不是从目录猜测“最新”文件。manifest 为每个 stage 指定 canonical receipt identity、schema、owner、scope、source commit/tree、producer change、status 和 content digest。闭合器从 baseline 的 declared source identity 得到期望值，要求所有输入逐字段一致；branch name、Issue number、文件修改时间和路径排序都不是 identity。

运行前必须证明 source worktree clean、Git tree 可解析且没有混合 worktree。当前 tree 与声明的 `sourceCommit`/`sourceTree` 不一致、`GIT_WORK_TREE` 或 Git toplevel 混用、输入 receipt 声称 dirty/mixed，均产生 `unresolved`，不得写出 qualified receipt。为避免派生 receipt 自身污染捕获，先在干净 source checkpoint 读取 identity，再将结果写入外部 CI artifact 或在后续提交中保存；不得把未提交的输出当作输入 source。

### 2. Denominator is an explicit partition, not a derived success count

每个 stage 提供稳定排序的 observation records，分类为 `included`、`excluded`、`duplicate` 或 `unresolved`，并提供 `discovered`、`included`、`excluded`、`duplicate`、`unresolved` totals。validator 要求：

```text
discovered = included + excluded + duplicate + unresolved
```

全局 totals 是所有 stage totals 的逐项和；不能通过丢弃重复 identity、忽略未解析记录或把排除项移到备注来减少分母。重复项保留每次出现的安全 identity 和冲突原因。隔离树与主树同路径但内容不同的记录使用 `worktreeRole:path:contentDigest` 区分，两个 observation 都进入分母，同时产生 unresolved identity conflict；不能静默选择其中一份。

### 3. Terminal coverage and freshness are separate from status

terminal registry 为每个 required stage 指定恰好一个 current receipt。它同时保存 `expected`、`present`、`missing`、`duplicate`、`stale`、`blocked`、`unresolved` stage IDs 和 coverage totals。receipt 若 source identity、schema、输入 digest、producer revision 或显式 supersession 不匹配，就属于 stale；archive 中的同名文件、关闭 Issue、已勾选 tasks 或旧 receipt ID 不会变成 current。

status 按安全优先级确定：

1. `unresolved`：dirty/mixed/tree drift、缺失或重复 current identity、stale receipt、分母不闭合、重复 metric identity、输入 unresolved 或无法解析 terminal coverage。
2. `blocked`：结构完整，但任一 current terminal 明确为 `blocked`，或 closure scope 仍有未退役的 blocking compatibility record。
3. `observed`：结构完整且没有 blocker，但至少一项 terminal/metric 只有观察结论，尚未提供可授予 closure 的 qualified terminal verdict。
4. `qualified`：所有 required inputs 和 terminal receipts 均为 current、source identity 一致、分母闭合，所有 closure-scope compatibility 已有删除证明，所有 required terminal verdict 为 `qualified`，且 before/after metrics 可逐项对应。

`blocked` 和 `unresolved` 永远不能被映射、降级或提升为 `qualified`。非 closure scope 的显式 observed compatibility 仍须列出，但不能用它掩盖 closure scope 中的未退役记录。

### 4. Metrics are references to authority-owned facts

`beforeMetrics` 与 `afterMetrics` 使用 `{metricId, scope, unit, value, sourceReceiptId, sourceField, status}` 记录。结构依赖、SCC、deep import、文件/中心节点和编译预算由 fitness authority 提供；命令、测试和工具结果由各自 command/toolchain authority 提供；领域前后状态由领域 terminal receipt 提供。闭合器只验证同一 `metricId + scope + unit` 的配对、digest 和 totals，不重新计算 graph、owner、budget、test inventory 或业务结果。缺少 after 值、单位或来源的 metric 进入 unresolved，不能默认为零或“无变化”。

### 5. One normalized receipt, deterministic serialization

规范化 receipt 采用固定 schema，例如：

```json
{
  "schemaVersion": "act-modular-monolith-closure/v1",
  "sourceIdentity": {"sourceCommit": "...", "sourceTree": "..."},
  "inputReceiptIdentities": [],
  "beforeMetrics": [],
  "afterMetrics": [],
  "totals": {"discovered": 0, "included": 0, "excluded": 0, "duplicate": 0, "unresolved": 0},
  "terminalCoverage": {"expected": [], "present": [], "missing": [], "duplicate": [], "stale": [], "blocked": [], "unresolved": []},
  "remainingCompatibilityRecords": [],
  "blockedRecords": [],
  "status": "qualified"
}
```

实现应使用既有 deterministic serializer，按稳定 key 和 identity 排序数组，receipt identity 取规范化 bytes 的 SHA-256。normalized receipt 不写 `generatedAt`、随机 run ID、机器绝对路径或输入 raw payload；新的环境测量只产生新的上游 receipt。相同 source identity、input bytes 和 receipt identities 必须产生 byte-identical normalized bytes，旧 receipt 不被覆盖。

### 6. Authority matrix and no second architecture

| fact | sole authority | closure responsibility |
| --- | --- | --- |
| source census and declared denominator | baseline | verify identity and totals only |
| owner and deprecation/compatibility ledger | charter | reference owner/record IDs only |
| graph, reverse edges, SCC and allowlist | dependency contract | consume report identity only |
| structural metrics and budgets | fitness report | consume before/after and budget status only |
| command/test discovery and failure semantics | test/quality contracts | consume terminal receipt only |
| tool graph and tool execution receipts | toolchain contracts | consume terminal receipt only |
| evidence class, privacy and retention | QA lifecycle | consume manifest identity/status only |
| migration/deletion completion | each domain owner | accept its terminal receipt, never infer completion |

闭合器的唯一 owner 是 charter catalog 中的 `platform` 架构控制面。唯一 planned entrypoint 是 `scripts/architecture-closure.ts`，唯一 reader 是同一 capability 的 typed reader；质量控制面可以调用它，但 product Web/worker、课程 runtime、Arena 和数据库不得导入它。characterization 必须扫描 package scripts、imports、OpenSpec 和 architecture docs，证明不存在第二个 global closure aggregator、平行 summary ledger 或无删除条件的 closure façade；census、charter、fitness 等上游专用命令不计为替代 aggregator。

### 7. Read-only lifecycle and rollback

闭合器只能读取输入并写入派生 receipt/reader 产物。它不得修改 baseline、charter、fitness、QA、terminal receipt、数据库、GitHub 或生产 selector。若验证失败，可写一个带安全失败代码的非-qualified receipt，不能删除或修订上游。

rollback 只移除本 change 产生的 canonical receipt、digest、reader 和 command mapping；保留所有上游输入、旧 receipt、domain migration/deletion 结果及其 immutable identity。恢复不通过改写上游状态、补写 terminal verdict 或切换生产指针实现。

## Risks / Trade-offs

- [Risk] 某个上游 proposal 看似完成但尚未产生 terminal receipt。→ manifest 只接受 schema-valid、source-bound 的 current receipt；proposal、Issue 和 checked tasks 仅作 excluded evidence，并使对应 stage unresolved。
- [Risk] 多个领域都声称同一指标或 owner。→ 使用 authority matrix 和 stable metric/owner identity；重复记录保留并进入 duplicate/unresolved 分母，不在聚合器中择一。
- [Risk] stale receipt 被路径或文件名重新发现。→ 禁止目录扫描作为选择机制，要求显式 manifest、content digest 和 supersession/current proof。
- [Risk] deterministic 输出泄露运行环境或私有 QA。→ 输出只含 portable identity、结论和 totals；privacy/path validator 在写出前拒绝 secret、绝对路径、raw payload 和用户标识。
- [Risk] 全局 receipt 被误当成生产发布资格。→ reader 只在质量/审查控制面可用，文档和 schema 明确 receipt 不触发 activation、deployment、selector 或 DB 写入。
- [Trade-off] 所有 required stage（包括 `assignment-retirement-1607` 和 `generated-content-reconciliation-1608`）都可能使初次状态 unresolved。→ 这是分母闭合的必要结果；对应 child Issue 的存在不替代 current terminal identity，仍须取得同 source revision 的 terminal receipt。

## Migration Plan

1. 在干净 source checkpoint 上冻结输入 manifest、owner/caller/script/test/data denominator 和 required terminal stage registry；记录 baseline、charter、dependency、fitness、test/toolchain、QA 的精确 receipt identity。
2. 实现 `src/lib/architecture-closure/` 的 schema、canonical normalization、identity/denominator/terminal validator 和 status precedence；不复制任何上游 discovery 或 authority。
3. 增加 `scripts/architecture-closure.ts` 及 `verify:architecture-closure`，只读取显式 manifest，生成一个 canonical normalized receipt 与 digest，并提供只读 reader 给质量/审查控制面。
4. 以同一输入运行 deterministic replay 和全部 fail-closed fixtures；确认每个 stage 都映射一个 terminal receipt，blocked/unresolved 不会变成 qualified，旧 receipt/Issue/archive/tasks 不能满足 current evidence。
5. 交由独立 review 检查 authority、分母、隐私、无 façade 和 rollback；修复仅限本 change 的 P0/P1。通过 strict OpenSpec 和 diff/whitespace 检查后再交接给质量控制面，不部署、不切换 selector、不写数据库。

## Open Questions

无。实际 terminal receipt 的文件位置和 producer 版本由各上游 change 在实现时登记；若其 identity、scope 或分母无法证明，闭合器必须保持 `unresolved`，不能猜测或补齐。
