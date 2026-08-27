## Correction (2026-08-27)

下文把分层门禁实现成 GitHub PR/integration CI 是错误边界。合入证据改为本地命令与 exact-current-HEAD 审查；GitHub Actions 只保留 `main` push 与授权 `workflow_dispatch`。见 `correct-pr-quality-gates-to-local-evidence`。

## Context

仓库当前 CI workflow 的主质量 job 在 `main` push/手动触发，另有面向 `integration` PR 的 Wolfram 专项 workflow，但没有把测试命令、production typecheck、架构 fitness、发布资格和分支保护组合成完整门禁。前置 changes 将 command/discovery、red baseline、TS graphs 和 architecture budgets 定义为独立可审计输入；本 change 只做 CI 控制面和 GitHub protection 的可验证映射。

## Hard Dependencies

已 qualified 的 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs`、`establish-architecture-fitness-budgets` 是本 change 的硬前置；同时消费 `restore-trustworthy-test-command-contracts` 的 command registry。依赖方向只从这些上游流向本 change，不形成回指或环；任一前置缺失、drift 或未 qualified 时保持 blocked。

## Goals / Non-Goals

**Goals:**

- 建立 PR、integration push、main/release、nightly 的明确层级和依赖顺序。
- 使每个 required check 能追溯到一个 local command ID、source revision/tree、scope 和 receipt。
- 使 `typecheck:tools` 与 `typecheck:test` 在 PR 或 integration 中成为 mandatory checks，并要求 main/release 在两图 receipts 均通过时才可发布；nightly 不承担补漏。
- 让 PR 受影响域选择在分母不闭合时自动扩大到安全范围或失败，不得静默漏跑。
- 保持 main/release 的 release、runtime、知识、OSS、rollback、readyz、数据库兼容强门禁。
- 以 GitHub ruleset/branch protection 的实际读取结果证明 integration 不可绕过；权限受限时如实报告 blocker。

**Non-Goals:**

- 不在本 change 中修复产品/测试 defect、不实现领域迁移、不修改 release selector 或部署运行态。
- 不把 workflow YAML 中一份重复命令列表当作第二套测试/graph/fitness authority。
- 不通过降低 main/release checks、允许管理员绕过或将红色结果标记为 accepted 来达成 green。
- 不把 REST 403、GitHub 计划限制、未读取到的 ruleset 或空 status 当作已保护事实。

## Decisions

### 1. 使用四层门禁

PR 层执行架构 fitness、受影响 lint、production/tooling/test typecheck、受影响领域 unit、contract、Prisma/schema/migration 检查和必要 critical E2E；integration push 执行全量 unit/contract/integration、production/tooling/test typecheck、Next build、WASM build、migration rehearsal 和 critical E2E；main/release 执行现有强门禁加 release qualification、runtime/knowledge/OSS candidate、rollback smoke、部署后 readyz 和数据库兼容性，并要求 tools/test typecheck receipts 均通过；nightly 执行隔离、视觉、性能、真实 provider、完整课程矩阵、数据治理回放、大规模 Arena/仿真且不替代 tools/test。每层只消费其 scope 的 command receipts。

### 2. Required check 与 local command 一一对应

每个 check registry record 保存 `checkId`、workflow/event、local `commandId`、输入 manifest、source revision/tree、receipt schema、timeout 和失败策略。workflow 只调用 registry 指定的本地命令；命令实现可以编排多个已定义子命令，但不能在 YAML 中另写一套隐式 include、skip 或 accepted-failure 逻辑。check 名称保持稳定，避免同一事实被多个状态名重复计数。

### 3. 受影响域选择必须闭合

PR 使用 baseline/charter、git diff、domain owner、test discovery、TS graph 和 fitness impact 计算受影响范围。若无法解析动态依赖、共享合同、migration、workflow、package、release 或 graph denominator，则扩大到完整相关 domain/integration scope；若仍无法安全确定，check 失败。不得以“无匹配文件”直接跳过 mandatory check。

### 4. Integration protection 只认平台真源

integration branch 的 required checks、strict status、review requirement、conversation resolution、bypass actors 和 ruleset enforcement 必须由 GitHub ruleset/branch-protection API 或平台 UI 导出的可审计 receipt 核实。若 REST 返回 403、计划不支持、权限不足或配置无法读取，状态为 `blocked-unverified`，保留响应类别和解阻条件；本地 workflow 通过不能替代分支保护。

### 5. 四张 TypeScript graph 是发布前硬输入

PR/integration 至少必须执行并阻断于 Web、worker、tools、test 四张 graph 的严格 `tsc` receipts，其中 `typecheck:tools` 与 `typecheck:test` 不得移到仅 nightly 的路径。main/release 在缺少、失败、过期或 source identity 不匹配的 tools/test receipt 时必须停止发布；nightly 只增加覆盖面，不承担补漏或恢复通过。

### 6. Main/release 强门禁不可被 PR 分层稀释

PR 是较快的必要门禁，不是 main/release 的替代品。release qualification、不可变 runtime/knowledge/OSS、rollback、readyz、DB compatibility 和其他既有强事实仍在 main/release 阻断；任何 workflow 变更必须比较前后 check registry，减少或降级强门禁需另有明确授权和 spec。

### 7. 质量状态采用安全 receipt

每层最终 receipt 绑定 source revision/tree、workflow run、check IDs、local command IDs、scope、required inputs、结果计数、unhandled errors、failure disposition、外部 blockers 和 artifact identities。receipt 不包含凭据、学生数据、原始答案、完整日志或本机绝对路径；未运行、超时、平台拒绝和证据漂移均不能写成 passed。

## Risks / Trade-offs

- [Risk] PR 影响面分析漏掉共享边界。→ 对 package、tsconfig、workflow、schema、release 和 unresolved graph 使用扩大范围/失败关闭策略。
- [Risk] integration ruleset 无法由当前权限读取。→ 生成 `blocked-unverified` receipt，明确要求具备读取权限或平台导出；不声称保护生效。
- [Risk] 全量 integration/build 成本高。→ 将它们放在 integration push，PR 保持受影响最小充分集合，但不降低 main/release 强门禁。
- [Risk] check registry 与 workflow 漂移。→ 增加静态 contract test，要求每个 required check 可解析到一个 local command，未知命令或重复权威直接失败。

## Migration Plan

1. 读取前置四项 change 的 qualified identities、command/receipt、TS graph、fitness budget 和 failure disposition，建立 check registry 草案。
2. 重构 workflow 事件与 jobs，逐层调用本地命令；将 tools/test typecheck 纳入 PR/integration mandatory checks，并将 release/nightly scope 与 PR product tests 分离。
3. 实现受影响范围闭合、check/local-command mapping、receipt validation 和 workflow contract tests。
4. 读取并验证 integration ruleset/branch protection，若出现 REST 403/计划限制则提交 blocker receipt，不宣称已保护；保留 main/release 强门禁。
5. 运行本地 PR/integration/release contract、相关 domain suites、build/WASM 和 strict validation；不创建 Issue、claim、部署或 activation。

## Open Questions

无。GitHub protection 的实际可读性是外部状态；不可读时必须保持 blocker，不能用推测补齐。
