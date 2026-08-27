# TypeScript 编译图

本仓库将 TypeScript 检查拆成四张独立 graph。根 `tsconfig.json` 仅保留 Next/编辑器兼容入口，不再作为生产 typecheck 的权威配置，也不包含仓库级 `**/*.ts` 或 `**/*.tsx`。

| graph | 配置 | 命令 | 责任范围 |
| --- | --- | --- | --- |
| web | `tsconfig.web.json` | `npm run typecheck:web` | Next App Router、Web features、resources、hooks、libraries |
| worker | `tsconfig.worker.json` | `npm run typecheck:worker` | 正式 worker、scheduler、submission scan/gc |
| tools | `tsconfig.tools.json` | `npm run typecheck:tools` | scripts、知识、runtime、证据和一次性工具 |
| test | `tsconfig.test.json` | `npm run typecheck:test` | Vitest、Playwright、脚本测试和测试配置 |

`npm run typecheck` 只执行 `web` 与 `worker` 两张 production graph。每个配置继承 `tsconfig.base.json` 的共享 compiler policy；base 不包含 `include` 或 `exclude`，各 graph 自己声明范围。四张 graph 保持 `strict`、`noEmit`、`moduleResolution: bundler`、`module: esnext`，并且不以 `skipLibCheck` 或扩大 heap 隐藏错误。

## 边界与共享合同

production graph 显式排除测试、scripts（worker 正式入口除外）、OpenSpec、docs、artifacts、logs、evaluate、数据、课程内容、生成目录和构建输出。TypeScript 的 `exclude` 不能阻止被 import 的文件进入 Program，因此 runner 还检查实际 Program 文件和 import/re-export/dynamic-import edges。production 到 tooling/test/generated/documentation 的边会产生 blocker。

Next 的生成类型由根兼容配置保留；独立 `web` graph 不把 `.next` 生成树作为 source root。生产运行时需要的 Next 约定入口、worker 正式入口和 package script 入口必须能被分类；未知入口会 fail closed。

共享合同只有一个 owner。当前合同 fixture 的 source owner 是 `web` graph 的 `typescript-graph-fixtures/shared-contract.ts`，worker、tools、test 通过 `shared-contract.declaration.d.ts` 消费声明边界。禁止在多个 graph 中复制 source include；owner、消费者、声明路径和版本由 `scripts/typescript-graphs/contracts.ts` 中的 registry 校验。

## Manifest 与 measurement receipt

graph runner 为每次命令生成两类工件：

- deterministic manifest：schema、graph scope、source commit/tree、config、include/exclude、compiler policy、entrypoints、Program 文件及 SHA-256、shared-contract owner。相同 source identity 和输入应得到相同 manifest hash。
- measurement receipt：manifest hash、命令、toolchain、平台、`cold`/`warm` cache mode、capture time、duration、peak RSS、file count、tsc exit status、fixture probe 和失败代码。duration、RSS、Node/OS 与 cache 状态只允许出现在 receipt，不得写入 manifest 或 deterministic core。

默认输出目录为 `.logs/typescript-graphs/`：manifest 位于 `manifests/`，不可变 receipt 位于 `receipts/`。可用 `TS_GRAPH_RECEIPT_DIR` 指定审计输出位置。cold run 使用 `--incremental false`；warm run 先建立临时 tsbuildinfo，再测第二次编译。临时构建状态不进入仓库。

当前工作区存在未提交修改时，receipt 会记录 `dirty: true`；这不是 qualified release evidence。后续门禁消费 receipt 时必须同时校验 source commit/tree、`dirty`、status 和 exit status。tools/test receipt 是 PR 或 integration 的 mandatory inputs；main/release 不得以 nightly 或缺失 receipt 替代。

## 失败夹具与验证

`typescript-graph-fixtures/{web,worker,tools,test}.ts` 各自被一张 graph 包含。runner 的 `--fixture-probe` 临时把对应 graph literal 改成非法值，必须由对应 `tsc` 诊断发现，结束后恢复文件；运行时测试和 lint 不构成夹具验收。

示例：

```sh
npm run typecheck:web
npm run typecheck:web -- --cache cold
npm run typecheck:web -- --fixture-probe
```

夹具、边界、owner、entrypoint、错误 exclude、strictness downgrade 和缺失/stale/failed tools/test receipt 的契约测试位于 `src/lib/__tests__/typescript-graphs.test.ts`。#1553 通过 `docs/architecture/fitness-budget-ledger.json` 消费 revision-bound graph manifest 与 measurement receipt；它不把编译内存写成跨环境永久阈值。PR/integration 的强制消费由 #1554 接入。
