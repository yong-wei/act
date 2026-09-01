## Why

业务 waves 完成后，`package.json` scripts、`scripts/`、`tools/`、architecture/quality/release command 和历史 alias 仍形成一个难以判断的 active tooling surface。重复入口可能执行不同的 source denominator、graph、receipt 或 failure policy；仅按命令名称或目录猜测 active，会让 CI、开发和发布使用不同工具链。

本 change 是 M9 的第一项基础变更（C34），只有在 C0 基线和业务 waves 稳定后执行。它建立 revision-bound tooling inventory，并在既有 command/toolchain owner 内合并重复 CLI；不创建第二套 shell、第二套门禁或新的 release/rollback authority。

## What Changes

- 盘点 `package.json` scripts、`scripts/`、`tools/`、`docs/architecture/toolchain-boundary`、TypeScript graphs、测试/发布命令及其调用者，给每项登记 owner、authority、inputs、outputs、verification、scope 和 status。
- 识别并删除重复、死的、只转发且无独立语义的 CLI/alias；保留有明确 operator compatibility 价值的薄 adapter，并记录删除条件。
- 让 active tooling 统一复用既有 `content-knowledge-runtime`、TypeScript graph、architecture fitness、quality/release 和 database scripts 的 canonical entries。
- 明确 `verify:commit`、`verify:push`、`typecheck` 及 release/rollback 唯一安全 validator 的职责与调用顺序，不以新 wrapper 隐藏失败。
- 保留生产 Web/worker、tool/test graph 分离、revision/source identity、portable receipt、privacy redaction 和 non-activating release semantics。
- 增加 inventory completeness、alias equivalence、unknown/dead command、graph boundary、failure propagation、privacy 和 rollback tests。

## Capabilities

### New Capabilities

- `active-tooling-cli-surface`: 规定 active CLI inventory、canonical command owner、alias 退役和门禁/receipt 组合边界。

### Modified Capabilities

None. `split-production-tooling-test-typescript-graphs`、`content-knowledge-runtime-release-toolchains` 和既有 quality/release specs 继续拥有各自的命令与回执语义；C34 只登记和收敛入口。

## Impact

- 主要范围：`package.json` scripts、`scripts/README.md`、`scripts/typescript-graphs/**`、`scripts/architecture*`、`scripts/runtime-release/**`、`tools/**`、quality/release command contracts 及测试。
- 前置依赖：C0 基线与全部业务 waves 的实现、审查和运行态稳定性；C33 的平台 composition 收口应先完成，不得以 active CLI inventory 掩盖未闭合业务 owner。
- 不新增 shell、第二套门禁、第二个 release/rollback validator、生产 selector、数据库事实、PlatformSetting 或业务 runtime。
- C35 依赖 C34 的完整 inventory 和 canonical command mapping。
