## Hard Dependencies

已 qualified 的 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs`、`establish-architecture-fitness-budgets` 必须同时满足，并消费 `restore-trustworthy-test-command-contracts` 的 command registry；依赖方向只向本 change 汇入，不形成回指或环。

## 1. Characterize inputs and current CI

- [ ] 1.1 核对 `restore-trustworthy-test-command-contracts`、`eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs` 和 `establish-architecture-fitness-budgets` 的 qualified identities、receipts、remaining blockers 与 owner。
- [ ] 1.2 Characterize `.github/workflows/`、package scripts、existing required checks、main/release workflow、WASM/build/migration/release commands 和当前 integration 保护可读性。
- [ ] 1.3 建立 check registry fixture，覆盖 required check 缺命令、重复 command authority、scope 漂移、受影响域无法闭合、external blocker 和 release gate 降级。

## 2. Implement layered gate contracts

- [ ] 2.1 定义 PR、integration push、main/release、nightly 的 event、scope、依赖、required checks、local command IDs、inputs、receipt 和失败语义，并将 `typecheck:tools` 与 `typecheck:test` 列为 PR/integration mandatory checks。
- [ ] 2.2 实现 required-check/local-command 一一映射校验，禁止 workflow 私自维护手工 Vitest include、silent skip、accepted failure 或 weaker duplicate command。
- [ ] 2.3 实现 PR 受影响域发现与 denominator-closed fallback：无法安全解析共享合同、migration、package、workflow、release 或 graph 时扩大范围或 fail closed。
- [ ] 2.4 组合 architecture fitness、production/tooling/test typecheck、affected unit/contract/lint、Prisma/migration 和 critical E2E；确保每项 receipt 绑定 source revision/tree，tools/test 类型错误可阻断 PR。
- [ ] 2.5 配置 integration push 的全量 unit/contract/integration、production/tooling/test typecheck、Next build、WASM build、migration rehearsal、critical E2E，以及 main/release 的 release/runtime/knowledge/OSS/rollback/readyz/DB compatibility 强门禁。
- [ ] 2.6 配置 main/release 仅在当前通过的 `typecheck:tools` 与 `typecheck:test` receipts 均存在时发布；缺失/失败/过期必须阻断，nightly 不承担补漏。
- [ ] 2.7 配置 nightly 的隔离测试、视觉/性能、真实 provider、课程矩阵、数据治理回放和大规模 Arena/仿真，明确其不替代 PR/integration 的 tools/test typecheck。

## 3. Verify real branch protection

- [ ] 3.1 通过可验证 GitHub ruleset/branch-protection 读取核对 integration 的 required checks、strict status、review/conversation gates、bypass actors 和 enforcement。
- [ ] 3.2 若 REST 返回 403、计划限制、权限不足或配置无法读取，生成 `blocked-unverified` receipt，保留安全响应类别、受影响 gate、source revision 和解阻条件；不得声称 protected。
- [ ] 3.3 对 main/release 比较前后 check registry，证明强门禁未被删除、降级、绕过或移入非阻断 job。

## 4. Remove or replace old authority

- [ ] 4.1 删除 workflow 中重复的测试列表、弱化的 main/release path、无 owner 的 `if` skip、历史 accepted failure 和与 local command 不一致的 job。
- [ ] 4.2 删除本 change 新增的重复 check registry/fitness/test discovery source；所有 scope、failure、TS graph、release evidence 继续引用前置权威。
- [ ] 4.3 将过期 workflow、required check、ruleset exception 和 bypass actor 记录到可删除的 governance ledger，补 owner、条件与后续 change。

## 5. Targeted and layered verification

- [ ] 5.1 运行 check registry/workflow contract tests，验证每项 required check exactly one local command、receipt、scope 和 failure policy。
- [ ] 5.2 本地执行 PR gate 命令及受影响 domain suite；对 integration 运行全量 unit/contract/integration/build/WASM/migration rehearsal/critical E2E 所需验证。
- [ ] 5.3 运行 release qualification contract，确认 runtime/knowledge/OSS、rollback、readyz、数据库兼容强门禁保持阻断语义，并验证 main/release 在 tools/test typecheck receipts 缺失或失败时阻断；nightly 仅做命令可解析性验证。
- [ ] 5.4 运行 `rtk openspec validate enforce-pr-integration-quality-gates --type change --strict` 和 `git diff --check`。

## 6. Documentation and receipt handoff

- [ ] 6.1 更新 CI 分层、required-check/local-command map、受影响范围 fallback、receipt schema 和 main/release 强门禁文档。
- [ ] 6.2 保存 integration ruleset/branch-protection verification receipt；若受限则明确 blocker，不把本地 workflow 通过写成平台保护。
- [ ] 6.3 向后续实现/审查提供最终 gate registry、remaining blockers、owner 和下一步 change，不创建 Issue、claim、部署或 activation。
