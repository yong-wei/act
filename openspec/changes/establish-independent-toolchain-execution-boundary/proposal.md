## Why

阶段 3 的主要结构性问题不是缺少脚本，而是产品、发布、证据和一次性操作共享同一套仓库入口与隐含依赖。当前根 `tsconfig.json` 仍以仓库级 glob 组织程序，工具责任分散在 `scripts/`、`course-content/scripts/`、`src/lib/teaching-projection/` 和 `artifacts/`；在 `edb98945e` 的基线中，Teaching Projection 共 93 个 tracked 文件，其中 `publish`、`qualify`、`rebase` 三个工具子树合计 40 个 tracked 文件，工具没有独立的执行身份、输出合同或回执。

本 change 的 source denominator 统一定义为 captured Git tree `sourceRevision` 上由 `git ls-files -- <path>` 枚举的 tracked entries。忽略、未跟踪、生成和运行时产生的文件均不计入 source denominator，包括 `__pycache__/` 和 `*.pyc`。若未来必须使用 generated/untracked 输入，必须作为独立的 `generated-input` 类别记录 producer/version、路径类别、内容摘要和 source revision；它不能改变 source denominator。

现在建立独立工具链边界，后续迁移才有单一入口、可复核分母和可删除的旧入口。该变更只建立边界和合同，不迁移具体业务工具、不运行数据变更，也不改变生产选择器。

## What Changes

- 建立 `tools/` 下的统一工具链入口、工具分类注册表、唯一 owner、命令 ID、输入/输出 manifest 和 revision-bound receipt 合同。
- 将内容导出审查、知识图谱/OSS runtime 发布、证据与视觉 QA、迁移/回填、比赛材料五类能力纳入同一执行边界；分类结果由一次冻结的 denominator 生成。
- 将公开 runtime bundle、manifest、数据库结果与私有运行证据分开；产品只能消费已发布、可移植、可验证的公开结果或数据库投影。
- 为工具提供独立的 typecheck/test 命令和结果回执，复用 `split-production-tooling-test-typescript-graphs` 的编译图与 `restore-trustworthy-test-command-contracts` 的命令语义，不另建第二套质量 authority。
- 建立产品构建到工具实现的反向依赖检查；工具可以产生产品输入，产品构建不得导入工具实现、run-specific 证据或一次性脚本。
- 记录旧入口、转发层和删除条件，为后续五个迁移 change 提供实际删除与回滚边界；不以 facade 代替迁移。

## Capabilities

### New Capabilities

- `independent-toolchain-execution-boundary`: 定义 ACT 工具链的分类、执行身份、公开输出、私有证据、独立验证和产品消费边界。

### Modified Capabilities

None. `split-production-tooling-test-typescript-graphs`、`modular-monolith-refactor-charter`、既有发布/证据/迁移能力继续作为上游合同；本 change 不复制或削弱它们的业务要求。

## Impact

- 观察分母是 captured Git tree 的 tracked entries：`scripts/knowledge-cutover`（52 个）、`scripts/runtime-release`（32 个）、`course-content/scripts`（41 个）、`scripts/tests`（229 个）、`scripts/migrations`（3 个）、`scripts/db`（76 个）、现有 `tools`（7 个）和 `artifacts`（5,528 个）。这些数量均由 `git ls-files -- <path>` 在 `edb98945e78ab0824f801806751fd57f97056347` 枚举得出；忽略、未跟踪、生成文件（包括 `__pycache__/`、`*.pyc`）不进入 source denominator。实现时必须在实际 source revision 重算；未来 generated/untracked 输入只能作为带 producer/version、内容摘要和 revision 绑定的独立 `generated-input` 类别，不能混入上述分母。
- 影响 `package.json` 的工具命令映射、`tsconfig.*` 项目引用、工具 manifest/receipt、CI artifact/对象存储上传和后续发布/证据/迁移入口。
- 为 `extract-teaching-projection-publishing-cli`、`isolate-content-knowledge-runtime-release-toolchains`、`isolate-migration-backfill-competition-toolchains` 和 `externalize-run-specific-qa-evidence-artifacts` 提供共同前置。
- 不修改 `src/app` 页面语义、数据库 schema、Rust/WASM、生产 selector、部署状态或历史运行证据；不创建 Issue、claim、部署或生产切换。

## Dependencies and Blockers

- 硬前置：`establish-modular-monolith-refactor-charter` 的 qualified owner/边界记录、`split-production-tooling-test-typescript-graphs` 的 qualified graph identity，以及 `restore-trustworthy-test-command-contracts` 的 command/receipt contract。任一分母、source tree 或命令身份漂移时，本 change 只能保持 blocked。
- `enforce-pr-integration-quality-gates` 是后续消费者：它必须读取本 change 的工具 registry、tools/test receipts，而不是在本 change 内提前修改 CI 或分支保护。
- 与 `coordinate-latest-authority-and-active-oss-cutover` 的协作边界是“提供独立工具入口和发布输入”，不接管其 candidate envelope、transaction、selector 或 activation；与 `stabilize-commercial-ui-qa-capture-contract` 的边界是“提供证据生命周期入口”，不改其服务 URL、Dock readiness、状态矩阵或产品 selector。
