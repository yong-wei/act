## Context

本 change 建立在已归档的 `restore-trustworthy-test-command-contracts` 与 `eliminate-accepted-red-test-baseline` 之上，并消费 A `capture-post-convergence-repository-and-architecture-baseline` 的 immutable successor。A 的 capture 只提供事实快照，不是 `REQUIRED_BASELINE` 或任何 active qualification；B 也只负责当前失败分母的调查与交接。

B 的硬门禁由父协调层从 live GitHub Issue 状态验证：Issue #1876 必须 closed、带 `status:archived`，且 native `blockedBy` 已解除。验证之前不能 claim/apply、运行实现检查点、执行测试或写 qualification artifact。门禁通过后，B 只能消费 A 明确提供的 subject identity：`sourceCommit`、`sourceTree`、`successorCaptureId` 和 successor digest，以及完整 artifact locator/digest；不能从旧 ledger、目录名或提案数字推断这些身份。subject identity 与 generator identity 必须分开记录。

当前测试合同横跨默认 PR、unit、contract、integration、critical E2E、release、nightly，以及注册在同一合同中的 Rust/WASM、OpenSpec、commercial-UI 和其他专项 scope。问题不是再造一个 runner，而是将独立发现的版本控制测试 universe、声明 roots/classifications、实际结果、环境测量与 failure disposition 绑定到一个可复现的 clean source tree。

## Goals / Non-Goals

**Goals:**

- 在 A successor subject 身份和 digest 锁定后，区分 subject 与 generator identity，使用现有 command/discovery/result/receipt/disposition/release 合同完成全量受管 scope 的当前分母调查。
- 对 discovered、represented、excluded、duplicate、unresolved 以及各 lane 的 pass/failure/skip/unhandled 计数做双向闭合；所有计数均来自当前 generator 输出，不成为永久常量。
- 让每个 failure fingerprint 保留 source identity、测试/命令身份、root-cause evidence、owner、lane、计划 disposition、closure condition 和适用的 expiry，并可由 compact output 追溯到完整受管工件。
- 使 default PR lane 只依据现有 registry 声明的 default mandatory scope/requiredInputs，在 failures、unhandled errors、unregistered skips、unresolved discovery 和未决 disposition 全部为零时产生 clean certificate；release、nightly、PostgreSQL、full Playwright 等非默认 lane 各自输出 pass、non-clean 或 BLOCKED，并保留 per-lane denominator/status。
- 保留 deterministic core 与环境敏感 measurement 的边界，并以 source/digest/privacy/determinism contract tests 证明输出可重放且不泄露敏感数据。

**Non-Goals:**

- 不建立新的 discovery、runner、quality gate、receipt registry、数据模型或测试数字口径；只扩展现有合同及其适配层。
- 不修产品或测试实现，不改断言、timeout、skip、retry、runner 或命令 scope，不删除测试，不执行任何 `FIX`、`DELETE` 或 `QUARANTINE` 后续动作。
- 不把 A successor 写入 `REQUIRED_BASELINE`、`REQUIRED_FITNESS_BUDGET` 或其他 active selector，不改变 CI/branch protection，不部署、不发布、不切换生产状态。
- 不把 `release-input` 或外部限制解释成默认 lane 的绿色；不以 accepted、静默排除、永久/无主 quarantine 或 flaky retry 替代关闭证明。
- 不提交原始日志、巨型逐测试 ledger、用户标识、答案/事件载荷、凭据、媒体内容或本机绝对路径，不开启后续 Issue，也不开始 N4。

## Decisions

### 1. 先锁定 A gate、subject identity 和 generator identity

父协调层先验证 #1876 的 live 状态、标签和 native 依赖；本 change 不在 OpenSpec 工件中伪造该关系。通过后，入口读取 A successor envelope，并要求其状态至少为可消费的 digest-verified/qualified-for-investigation、身份完整且 locator 可验证。subject identity 固定为 A 的 `successorCaptureId`、`sourceCommit`、`sourceTree` 和 successor digest；它描述被测/被发现的 source，不等于生成器自身的修订。所有 B discovery manifests、command receipts、failure inventory、disposition summary 和结论都必须携带 subject identity。

若 B 需要修改 collector、projector 或 validator，先形成 clean tool implementation checkpoint，并记录 `toolCommit`、`toolTree`、schema/version 和入口 bundle digest；若现有工具无需改动，tool identity 可以等于 subject，但仍必须显式记录两组字段。随后应在独立 clean subject checkout 中执行 governed commands，或由 clean tool checkout 消费 subject checkout 的输出。每个 discovery core、measurement receipt 和 failure package 同时绑定 subject 与 tool identities；最终 artifact commit 只承载结果，不得伪装成 subject tree。

入口再读取 subject checkout 的 Git identity 和工作树状态，确认与 A 声明的 source tree 相同且无 dirty/mixed/unresolved state；tool checkout 也必须 clean 且匹配记录的 tool identity。生成期间在写入前做第二次 subject/tool identity read；任意变化、A artifact 漂移、locator 缺失或 digest 不匹配都 fail closed，不能替换为另一个 revision，也不能覆盖已有 receipt。

备选方案是直接使用当前 HEAD、把 tool revision 隐含在 artifact commit 中，或复用历史 baseline 数字。前两者无法区分被测 subject 与生成器漂移，后者把暂时观察伪装成永久分母，均违反 revision-bound 与 successor handoff 合同，因此不采用。

### 2. 复用现有命令合同完成独立 universe 双向闭合

以 `scripts/test-command-contracts.ts` 和 `src/lib/architecture-test-commands/**` 为唯一实现边界：

1. 由版本控制文件集合、受支持的命名约定和显式、带 owner/reason/removal-condition 的排除规则独立生成 repository test universe。
2. 单独读取命令 registry 声明的 roots、layer/classification、lane 和 scope，将两组集合按稳定 repository-relative identity 做 forward/reverse reconciliation。
3. 对每个命令执行既有 scope，不用手工 include 清单、目录名称或提案阶段数量替代发现结果。未声明 root、无分类、未处理 skip、孤立 declaration、duplicate identity 和 artifact/source drift 都进入结果并阻断相应 qualification。
4. 对已登记的 Rust/WASM、OpenSpec、commercial-UI 或其他专项命令沿用其现有 contract；只有 registry 真正登记的 scope 才进入 B，不能临时扩大或缩小命令范围。

备选方案是为 B 增加一套独立扫描器或固定 test list。这样会复制 authority，且无法发现声明之外的文件；因此只新增现有核心所需的 projection/validation，不新增 universe、runner 或 quality authority。

### 3. 将执行结果和测量分成两层不可变 receipt

每个 lane 产生 deterministic result core：command ID、scope、subject identity、tool identity、command-docs/entry-bundle digest、discovery manifest hash、稳定测试身份、分类/排除、结果计数、failure fingerprints、skip/unhandled 分类和资格状态。duration、RSS、Node/OS、外部服务响应类别等环境变量只能写入独立 measurement receipt，并通过不可变 identity 引用，不回写 deterministic core。各 lane 的 denominator/status 独立保留，不能用全局聚合替代。

receipt 的正常化序列化使用稳定排序和 bounded safe summaries；同一 subject、tool、registry、A digest 和冻结输入重复生成时 deterministic core 必须 byte-identical。subject 或 tool 任一漂移都必须 fail closed。新的测量只能产生新的 receipt，不能覆盖旧 receipt。执行失败或外部不可用保留 safe response class、owner、resolution condition 与 exit status；不记录 token、cookie、原始响应、完整命令日志或敏感 payload。

default PR 的结论只读取现有 registry 声明为 default mandatory 的 scope 和 requiredInputs。release、nightly、PostgreSQL、full Playwright 等非默认 lane 分别计算自身 denominator 和 pass/non-clean/BLOCKED 结论；缺少 release manifest 或 `nightly-not-run` 只阻断对应 lane，不得污染或隐去 default clean。全局 summary 可以汇总各 lane，但必须保留每个 lane 的状态和分母，只有 registry 显式声明的依赖才允许跨 lane 传递影响。

### 4. 以 fingerprint 和计划 disposition 表示当前失败

fingerprint 由 command/lane、repository-relative test identity、failure stage、normalized error class/summary、相关 artifact identity、subject identity 和 tool identity 共同稳定化；同根因可共享 root-cause record，但每个 fingerprint 仍保留成员追踪。B 只生成计划 disposition，不实施修复或删除：

- `FIX`：存在当前产品/测试合同且需要后续根因修复；必须带 owner、root-cause evidence、lane、closure condition。
- `DELETE`：测试/断言对应的能力已退役且有 replacement/retirement、owner/call-site evidence 与删除条件；`remove` 仅是该值的历史别名，不作为第五类。
- `QUARANTINE`：仅允许明确的、具名的 non-default lane；`release-input` 是其中受管 subtype，必须绑定 release qualification manifest、owner、reason、expiry 和迁入条件。在真正迁出 default 前仍阻断 default，永久或无主 quarantine 不合法。
- `BLOCKED`：外部服务、权限、计划、运行环境或缺失上游证据造成的不可判定项；`external-blocker` 是该类的 safe reason，不得写成 passed/clean。

任何 fingerprint 缺少 owner、evidence、lane、closure/expiry（适用时）或命中 accepted/silent-skip/flaky-retry 语义，均保持 unresolved blocker。disposition validator 拒绝把未关闭计划写进 clean certificate。

备选方案是沿用历史 `accepted`/`release-input` 平铺枚举或按失败行数处置。平铺枚举会把发布证据与默认产品测试混淆，按行数会丢失同根因和单 fingerprint 可追溯性，因此不采用。

### 5. Git 只保存 compact handoff，不保存原始执行数据

在 change 目录内生成受 schema 约束的 compact package，至少包含：A subject identity、tool identity envelope、命令/lane manifest、universe closure summary、per-lane denominator/status、receipt index、failure/disposition summary、clean/non-clean conclusion 和完整工件 locator/digest。完整逐测试 inventory、原始命令输出和环境细节写到受管 local/CI artifact，并在 compact package 中记录逻辑 locator、字节数和 SHA-256。

输出生成前后运行 privacy validator，拒绝绝对路径、credential-like 字段、learner/user identity、raw answer/event、media/screenshot/model body 和 unbounded log。任何 locator 失效或 digest drift 都是 blocker，不使用 best-effort fallback。

### 6. 结论只由零项不变量计算

default PR clean certificate 的判定输入固定为 registry 当前声明的 default mandatory scope/requiredInputs：失败、未处理错误、未登记 skip、unresolved discovery、subject/tool/receipt drift 和未决 disposition 均为零，且这些 scope 均已执行并完成 receipt。release、nightly、PostgreSQL、full Playwright 等非默认 lane 各自输出自身 pass、non-clean 或 BLOCKED 结论；缺少 release manifest、`nightly-not-run` 或非默认 lane 未运行不得污染 default clean，也不得在全局 summary 中隐去。只有 registry 显式声明的依赖才可跨 lane 传递阻断。该结论绑定当前 subject/tool identities，不推广到后续 HEAD 或另一生成器。

## Risks / Trade-offs

- [Risk] A 尚未完成或其 successor artifact 不可验证，B 无法开始；工具修订还可能被错误地当作 subject。→ 将 gate、subject/tool identity、locator 和 digest 作为最先验证的 fail-closed 输入，并保留 blocked 原因，不自行捕获或猜测。
- [Risk] 独立 universe 暴露更多未登记测试或孤立声明。→ 原样进入 denominator/unresolved 输出；交由后续实现 change 处理，不在 B 静默排除。
- [Risk] 各登记 lane 的执行可能受数据库、浏览器、Rust/WASM、商业 UI 或外部权限限制，且非默认 lane 状态可能被汇总混淆。→ 记录 per-lane denominator/status、bounded measurement/blocker receipt 和解阻条件；不伪绿，不将非默认 lane 缺失改写为 default 成功或失败。
- [Risk] fingerprint 正规化过度会合并不同根因，过度保守又会重复处置。→ 只共享有证据的 root-cause record，保留每个测试/命令成员和证据 locator，无法证明时保持独立 unresolved。
- [Risk] Git compact output 省略细节影响复核。→ 记录完整受管 artifact 的逻辑 locator、byte count、digest 和 schema，消费方先验证后读取；禁止提交巨型 ledger。
- [Risk] 当前结论很快因 subject 或 tool 变化而过期。→ 所有 receipt 和 conclusion 同时绑定 subject/tool commit/tree、A successor identity 和 entry-bundle digest，任何一方变化都要求重新生成，不覆盖旧记录。

## Migration Plan

1. 父协调层确认 #1876 closed、`status:archived` 和 native `blockedBy` 已解除；在此前所有 B 活动保持 blocked。
2. 读取并验证 A successor subject identity/digest/locator，再建立 clean tool implementation checkpoint（若工具有改动），记录 tool identity、schema/version 和入口 bundle digest；分别验证 clean subject checkout 与 clean tool checkout，记录失败条件但不写 qualified receipt。
3. 在现有合同中登记/投影 subject/tool identities、universe 双向闭合、每个实际 lane 的 scope/requiredInputs 和 receipt 输入；运行 focused contract fixtures 验证 determinism、privacy、source/tool drift 和 fail-closed 条件。
4. 按 registry 声明的 scope 分 lane 运行所有实际登记的 governed commands，生成 immutable result/measurement receipts，建立每个 fingerprint 的 evidence-backed planned disposition；只调查，不执行 disposition。
5. 生成 compact package 和完整 artifact locator/digest，保留 per-lane denominator/status，重放 deterministic projection，验证 subject/tool identity、digest 和 privacy 一致。
6. 仅当 registry default mandatory scope/requiredInputs 的零项不变量全部满足时，输出绑定当前 subject/tool identity 的 default clean certificate；各非默认 lane 独立输出 pass、non-clean 或 BLOCKED，否则输出 non-clean blocker package，列出 blocker、owner、lane、解阻/closure 条件，不声称 clean。
7. 将 compact handoff 交给后续授权的 FIX/DELETE/QUARANTINE 实施和 N4；B 不开新 Issue、不修改 active baseline/fitness/CI/生产状态。若需要回滚，删除或撤销本次未被消费的 compact candidate，并保留已发布 immutable receipts，不覆盖 A 或历史 baseline；任何 partial artifact 由 digest 校验器拒绝消费。

## Open Questions

无需要在本 proposal 阶段决策的问题。实现时若 A gate、successor identity、实际 registry scope、fingerprint 根因或外部能力状态无法从受管证据判定，必须产生 BLOCKED/unresolved 记录并停止 clean qualification，而不是自行扩大范围或选择默认值。
