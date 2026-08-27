# 分层质量门禁

本能力建立四层**本地**质量证据面：PR 合入证据、`integration` revision 证据、`main/release` qualification 和 nightly breadth。它组合既有测试命令合同、四张 TypeScript graph、architecture fitness 预算和发布合同；这些输入仍由各自的既有权威维护。

质量门禁规定“合入或发布需要哪些可审计证据”，不要求这些证据由 GitHub 托管 CI 生成。

## 权威与执行边界

`scripts/quality-gates/registry.ts` 是门禁映射的唯一实现权威，`docs/architecture/quality-gates/registry.json` 是可审阅的生成投影。测试发现继续来自 `src/lib/architecture-test-commands`，TypeScript graph 继续来自 `scripts/typescript-graphs/contracts.ts`，fitness 继续来自 `src/lib/architecture-fitness` 与冻结预算 ledger，发布资格继续来自 `src/lib/architecture-test-commands/release.ts`。

四层的 layer event 都是 `local`。提交和推送门禁继续由 `verify:commit`、`verify:push`、typecheck、相关测试和 exact-current-HEAD 审查承担。本地 `quality-gates:validate` / `quality-gates:run` 可以按层生成 receipt，但不是 GitHub required status check。

GitHub Actions 只保留：

- `.github/workflows/ci.yml`：`push` 到 `main` 与明确授权的 `workflow_dispatch`；jobs 仅既有 model-assets 与 lint/test/build。
- `.github/workflows/docker-wolfram-verify.yml`：专项 `workflow_dispatch`，不是通用质量门禁。

禁止：`.github/workflows/quality-gates.yml`、面向 `integration` 的通用 `pull_request` / `push` 质量 workflow、nightly schedule 通用质量 workflow、`ci.yml` 的 `release/**` 触发器，以及把 registry `checkId` 配成 GitHub required check。

当前 registry：`act-pr-integration-quality-gates`，schema `act-pr-integration-quality-gates/v1`，hash `1a2806138162cbb7b6169503cb9734b5d927f8c8200c7d470da659410ea8227c`。每个 required check 只有一个 local command ID，或明确标注为多个既有 command 的 `all-must-pass` composition。

## 分层映射

| 层 | 生产者与范围 | 阻断内容 | owner |
| --- | --- | --- | --- |
| PR | 本地证据；受影响域，分母不闭合时扩大或阻断 | fitness、lint、Web/worker/tools/test 四 graph、affected unit、contract、migration rehearsal、critical E2E | platform |
| integration | 本地证据；当前 revision 全量 | full unit、contract、integration、四 graph、Next build、WASM build、migration rehearsal、critical E2E、fitness | platform |
| main/release | 单独授权的本地或后续授权的发布验证 | 四 graph 当前 receipts、release qualification、runtime、knowledge、OSS、rollback、readyz、DB compatibility | release |
| nightly | 本地或单独授权的广度验证 | 隔离、视觉/性能、真实 provider、课程矩阵、数据回放、Arena、simulation | platform |

PR 和 integration 的 `typecheck:tools`、`typecheck:test` 都是 mandatory。nightly 不运行它们，也不能修复或替代其缺失、失败、过期 receipt。main/release 保留现有 `ci.yml` 的 model asset、lint、smoke test、build 和 WASM 强路径，但不把 registry 发布层挂到 GitHub job；PR 通过不削弱发布层。

## PR 影响面分母

影响选择使用以下分母：dependency graph、TypeScript graph、test discovery、owner map、migration scope、package scope、workflow scope 和 release scope。

- 分母闭合且路径可分类时，选择对应的 affected checks；基础 fitness、lint、四 graph 和 contract 始终存在。
- shared、unknown、package、tsconfig、workflow、graph、release 或 architecture 边界变化会扩大到完整相关范围。
- 分母输入标记为 unresolved 时，默认扩大到完整 PR checks；调用方明确不能扩大时返回 `blocked`。
- 空变更集、无法分类的路径和未解析的动态依赖不产生“无匹配所以跳过”的 green 结果。

选择结果会写入 layer receipt 的 `scope`、`requiredInputs`、`checkIds` 和 failure disposition，供后续审查复现。

## Receipt 合同

每层 receipt 使用 `act-quality-gate-receipt/v1`，至少包含：

- `sourceCommit`、`sourceTree`、`dirty`、`mixedWorktree` 和可选的本地/workflow 运行 identity；
- stable-sorted `checkIds`、local `commandIds`、scope、required inputs 和结果计数；
- 每个结果的 status、exit status、receipt IDs、failure codes 和 unhandled error count；
- failure dispositions、external blockers 和 artifact identities；
- 捕获时间以及由规范化内容计算的 receipt ID。

图 receipt 不能只看 `npm run typecheck` 的进程退出码。PR/integration 及 release 验证同时要求 Web、worker、tools、test receipt 的 source identity 匹配，`dirty=false`、`status=passed`、`exitStatus=0`、`tscErrorCount=0`，且不是 fixture probe。因 production-to-tooling/documentation 等原因出现 `status=blocked` 时，即使进程退出 0，也必须阻断。

receipt 生成使用不可变文件创建；同一 receipt ID 只能重读相同内容，不能覆盖既有证据。receipt 不写入凭据、学生数据、原始答案、完整日志、本机绝对路径或解析器原文。

## main/release 强门禁

`validateMainReleasePreservation` 对 protected release check 做前后比较，删除、移动、改为 advisory、改为非阻断、命令漂移或 scope 漂移都会失败。`main-release` 还会重新读取全部四张当前 graph receipts，因此缺少或不合格的 `typecheck:tools` / `typecheck:test` 会阻断发布；`test:release` 缺 qualification manifest 仍 fail closed。恢复 GitHub `main` 基线不得把这些本地发布合同降级。

这套门禁不执行 production selector、部署、activation 或 rollback 操作；rollback 和 readyz 项目是合同检查，真实发布仍需既有发布授权和运行态证据。

## 当前状态与下一步

当前实现没有把未合格事实伪装成通过：

| 事实 | 状态 | owner | 下一步 |
| --- | --- | --- | --- |
| GitHub-hosted PR/integration CI | 已删除；枚举 `.github/workflows/*`，禁止 `pull_request`、`integration` push 与 nightly `schedule` | platform | 保持 `validateGitHubHostedCiBoundary` fail-closed，禁止改名后重新引入 |
| integration GitHub required CI checks | 未读取平台 ruleset 时只能是 `blocked-unverified`；dirty 不得写成 `verified` | platform | 合入证据继续用本地命令和 exact-current-HEAD 审查；不得用仓库文件声称远端 required checks 为空 |
| `fitness:architecture` | 当前冻结指标增长、feature→app 未登记、缺 frozen graph receipts | architecture/platform | 单独修复或重新 qualified fitness 输入；本 change 不改预算 |
| `typecheck:tools` | 既有 tsc debt，仍为 PR/integration mandatory | tooling | 修复 graph 自身错误并生成当前 clean receipt |
| `typecheck:test` | 既有 tsc debt/OOM，仍为 PR/integration mandatory | tooling/test | 修复或拆解 graph 资源问题并生成当前 clean receipt |
| `test:release` | qualification manifest 缺失，继续 fail closed | release | 由发布流程生成并核验当前 manifest |
| full integration / nightly breadth | 不由 GitHub Actions 自动执行 | integration/platform | 在稳定 revision 上按需本地运行对应层；未运行不写为 passed |

平台保护核验见 [`quality-gates/integration-protection-verification.json`](quality-gates/integration-protection-verification.json)，治理遗留与例外见 [`quality-gates/governance-ledger.json`](quality-gates/governance-ledger.json)。
