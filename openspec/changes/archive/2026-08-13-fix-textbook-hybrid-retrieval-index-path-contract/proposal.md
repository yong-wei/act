## Why

智能备课依赖教材混合检索索引，但代码默认路径、运行时资源、构建/发布/部署脚本之间存在路径漂移：README 与真实索引位于 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`，而适配器与多数脚本仍引用 `textbook-retrieval`。此外，当前索引 `windows.jsonl` 缺少 loader 与 schema 强制的 `segments` 字段，即使修正默认路径也无法加载索引。

## What Changes

- 将运行时混合检索索引的默认路径统一为 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`。
- 明确路径优先级：显式 `indexRoot` > `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT` > 默认路径。
- 同步修正 `src/app/course-runtime/[...assetPath]/route.ts`、`scripts/build.sh`、`scripts/remote-deploy.sh`、`scripts/release/export-textbook-runtime-v2.mjs`、`scripts/release/validate-textbook-runtime-v2.mjs` 及相关测试。
- 重建 `bge-m3` 索引，使 `windows.jsonl` 包含 `segments`，并与当前 `textbooks-v2` 运行态一致。
- 将路径契约与索引窗口格式要求固化到 `textbook-hybrid-retrieval` spec。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `textbook-hybrid-retrieval`: 新增运行时索引路径、路径优先级、索引窗口 `segments` 契约与发布校验要求。

## Impact

- 运行时代码：`src/lib/source-pack/textbook-v2-adapter.ts`、`src/app/course-runtime/[...assetPath]/route.ts`。
- 构建/发布/部署：`scripts/build.sh`、`scripts/release/export-textbook-runtime-v2.mjs`、`scripts/release/validate-textbook-runtime-v2.mjs`、`scripts/remote-deploy.sh`。
- 测试：`src/lib/__tests__/textbook-v2-adapter.test.ts`、`src/app/__tests__/course-runtime-route.test.ts`、`scripts/tests/test-runtime-externalized-deploy.mjs`、`scripts/tests/test-remote-deploy-script.mjs`。
- 运行态资源：`course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`。
- 关联 Issue：https://github.com/yong-wei/act/issues/1305
