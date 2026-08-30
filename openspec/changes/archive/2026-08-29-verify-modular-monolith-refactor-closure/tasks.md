## 1. Scope, authority and denominator characterization

- [x] 1.1 读取并固定 baseline、charter/deprecation ledger、modular-domain dependency contract、fitness report、test/toolchain receipts、QA evidence manifests 的 qualified identity；proposal、Issue closed、checked task、archive 目录和旧 receipt 只能记录为非当前 evidence。
- [x] 1.2 建立 required terminal stage registry，覆盖 `governance-1548`、`quality-1554`、`toolchain-1557`、`toolchain-1558`、`toolchain-1559`、`assessment-personalization-1567`、`course-classroom-1576`、`learning-record-1587`、`knowledge-resource-1592`、`practice-1602`、`assignment-retirement-1607` 和 `generated-content-reconciliation-1608`；#1607/#1608 是当前 child Issue identity，tracking parent #1603 仅作协调记录，不作为 blocker 或 terminal evidence。
- [x] 1.3 冻结实现分母：唯一 owner=`platform` 架构控制面；调用方仅为 `verify:architecture-closure` 和质量/审查 reader；脚本为 `scripts/architecture-closure.ts`；测试包含 schema/unit 与 command/fixture 两类；数据/模型分母明确为文件/CI receipt，Prisma、事件、数据库和 learner state 均为零。
- [x] 1.4 Characterize 所有输入 receipt、terminal reader、package script、architecture doc、OpenSpec reference 和现有 closure-like command，确认 isolated/main 同路径异内容、excluded、duplicate、unresolved 的安全 identity 规则。
- [x] 1.5 完成 zero-alternative-aggregator / no-facade 证明：确认 census、charter、fitness 等专用 authority 不被复制，并列出任何 competing global summary、re-export、平行 ledger 或无删除条件 façade。

## 2. Schema, validator and authority contract

- [x] 2.1 定义 `act-modular-monolith-closure/v1` 的 input manifest、receipt identity、source identity、stage、metric、observation、terminal coverage、compatibility、blocked record 和 status schema。
- [x] 2.2 实现 source commit/tree、schema、content digest、producer revision、current/supersession、owner 和 scope 校验；dirty/mixed worktree、tree drift、identity drift 和不安全路径必须 fail closed。
- [x] 2.3 实现每 stage 的 `included/excluded/duplicate/unresolved` observation 分区与 totals 校验，确保 `discovered = included + excluded + duplicate + unresolved`，全局 totals 等于各 stage 之和。
- [x] 2.4 实现 terminal coverage 一对一校验，保留 missing、duplicate、stale、blocked、unresolved stage；每个附件 stage 必须映射一个 current terminal receipt。
- [x] 2.5 实现 before/after metric 的 authority 引用和配对校验；不重算 graph、owner、budget、test inventory、QA 分类、AI 状态或领域结果，缺失/重复/不匹配值进入 unresolved。
- [x] 2.6 实现 authority boundary 与 privacy/path validator：只保存 immutable identity、结论、safe totals 和引用，不接受 raw evidence、凭据、用户标识、答案、cookies、绝对路径或运行日志。

## 3. Deterministic generator and canonical consumer

- [x] 3.1 在 `src/lib/architecture-closure/` 实现纯规范化聚合器、status precedence 和既有 serializer/identity helper 适配；不得新增第二套 graph、ledger、budget、test discovery 或 QA lifecycle。
- [x] 3.2 实现 `scripts/architecture-closure.ts` 与 `verify:architecture-closure`，只读取显式 input manifest，先捕获 clean source identity，再输出一个 canonical normalized receipt 和 digest。
- [x] 3.3 固定数组/key 排序、receipt digest 和不含 timestamp/random ID/local path 的序列化；同一 source/input bytes 必须生成 byte-identical normalized receipt，新环境测量只接受新的上游 receipt。
- [x] 3.4 提供唯一 typed reader 给质量/审查控制面，证明 Web、worker、课程 runtime、Arena、数据库和生产 selector 不导入闭合器、reader 或 private QA evidence。
- [x] 3.5 明确无持久数据模型：不改 Prisma schema、migration、DB、事件、学习者状态或 runtime；生成 receipt 仅为派生文件/CI artifact。

## 4. Fixtures and regression verification

- [x] 4.1 添加 unchanged qualified fixture，验证 baseline/charter/dependency/fitness/test/toolchain/QA/domain identities、before/after metrics、terminal mappings 和 totals 完整可重放。
- [x] 4.2 添加 dirty、mixed-worktree、source commit/tree drift、schema drift、producer drift 和 stale terminal fixtures；全部 fail closed 且不写 qualified receipt。
- [x] 4.3 添加 missing terminal、duplicate identity、duplicate metric、incomplete denominator、excluded/duplicate/unresolved record 和 isolated/main same-path different-content fixtures；验证各记录保留并计入分母。
- [x] 4.4 添加 `blocked`、`unresolved`、`observed`、`qualified` precedence fixtures；证明 blocked/unresolved/observed 不能提升为 qualified，remaining compatibility 与 blocked records 保留 owner、原因和删除/解阻条件。
- [x] 4.5 添加旧 Issue/checked task/archive/old receipt 误用 fixture、proposal-only fixture、privacy/credential/absolute-path/raw-evidence fixture 和 no-facade fixture。
- [x] 4.6 运行两次相同输入的 normalized byte/digest equality、输入变更后的新 receipt identity、唯一 consumer import boundary、rollback 仅移除派生产物的回归测试。

## 5. Handoff, review and validation

- [x] 5.1 将 stage registry、authority matrix、input denominator、remaining compatibility、blocked/unresolved records 和最小 native `blockedBy` map 交给主线程；将 #1607/#1608 作为对应 stage 的 child blockers，明确 tracking parent #1603 不作为 blocker、terminal receipt 或 qualification evidence。
- [x] 5.2 运行 closure schema/validator、fixture、deterministic replay、privacy/path、reader boundary 和 no-alternative-aggregator tests；保存 test/toolchain receipt，不以测试通过替代上游 terminal receipt。
- [x] 5.3 运行 `openspec validate verify-modular-monolith-refactor-closure --type change --strict`、`git diff --check` 和 whitespace/path 检查；记录全局既有 validation debt 与本 change 结果分离。
- [ ] 5.4 进行一次独立 review，限于本 change 的 source identity、分母、terminal coverage、authority/隐私、status、无 façade、consumer 和 rollback；按 ACCEPT/REJECT/DEFER 处理发现，不扩大范围。
- [x] 5.5 完成 rollback rehearsal：删除本 change 的 receipt、digest、reader、command mapping 后，上游 baseline、charter、fitness、QA、toolchain 和 domain artifacts 的 bytes、identity 与状态保持不变；明确 receipt 产生不等于 production activation。
