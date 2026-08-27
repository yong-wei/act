## Hard Dependencies

`capture-modular-monolith-refactor-baseline` 与 `restore-trustworthy-test-command-contracts` 必须同时 qualified 且 source identity 可追溯；`enforce-pr-integration-quality-gates` 消费本 change 的 graph receipts，不形成回指依赖。

## 1. Characterization and graph inputs

- [x] 1.1 读取 `capture-modular-monolith-refactor-baseline` 与 `restore-trustworthy-test-command-contracts` 的 TypeScript file/edge/entrypoint inventory、命令 contract 与 measurement receipt，确认 source revision/tree 未漂移。
- [x] 1.2 Characterize 根 `tsconfig.json`、Next/worker/tool/test entrypoints、其他 tsconfig、build scripts、`vitest.config.ts` 和 Playwright/one-off fixtures，区分 production/tooling/test/framework/generated。
- [x] 1.3 建立 shared contract owner fixture，覆盖 Web 与 worker 共享、工具/测试消费、重复 include、循环和无 owner 情形。

## 2. Implement independent TypeScript graphs

- [x] 2.1 创建 base、Web production、worker production、tooling、test project 配置，保持 strict、noEmit、module resolution 和路径合同，并用 project references/声明输出表达唯一 owner。
- [x] 2.2 实现 production graph 的显式 include/exclude 与边界检查，排除 scripts、tests、OpenSpec、docs、artifacts、evaluate、生成目录和一次性工具；对未知 entrypoint fail closed。
- [x] 2.3 增加 `typecheck`（production aggregate）、`typecheck:web`、`typecheck:worker`、`typecheck:tools`、`typecheck:test` 等具名命令，并输出 command/graph receipt；将 tools/test receipts 标记为 PR 或 integration mandatory inputs。
- [x] 2.4 实现 graph manifest 与 cold/warm RSS/time/file-count measurement receipt，绑定 source revision/tree、toolchain、cache mode 和 scope，禁止将变量写入 deterministic core。
- [x] 2.5 为 production->tooling/test、duplicate shared contract owner、未分类 entrypoint、错误 exclude、strictness 降级和 main/release 缺少 tools/test receipts 添加契约测试。
- [x] 2.6 为 Web、worker、tools、test 各建立一个仅对应 `tsc` 可发现的类型错误 fixture，并验证注入 fixture 时对应 graph command 和 mandatory receipt 失败；运行时测试/lint 不得替代该失败验收。

## 3. Remove or replace old authority

- [x] 3.1 将根 `tsconfig` 的仓库级广义 glob 从 production typecheck 权威中移除，保留必要的 base/config compatibility 但不允许其重新吞入非生产图。
- [x] 3.2 将工具、测试和一次性脚本从统一 typecheck 调用迁入各自具名命令，删除本 change 引入的重复 include、复制合同和无 owner adapter。
- [x] 3.3 将 `NODE_OPTIONS` heap 增大从结构修复路径中移除或降级为明确的运行环境配置，并在文档中记录其非权威性。

## 4. Targeted and affected-domain verification

- [x] 4.1 运行 `typecheck:web`、`typecheck:worker`、`typecheck:tools`、`typecheck:test` 和默认 production `typecheck`，分别保存 scope/result receipts，并确认 tools/test receipts 可供 PR/integration mandatory checks 消费。
- [x] 4.2 运行受影响的 lint、unit/contract、Next build、WASM build 或 worker/tool validation；将既有失败单列，不写成 accepted production success。
- [x] 4.3 运行 `rtk openspec validate split-production-tooling-test-typescript-graphs --type change --strict` 和 `git diff --check`。

## 5. Documentation and handoff

- [x] 5.1 更新 TypeScript graph、共享合同 owner、命令映射、排除边界和 measurement receipt 文档，明确 cold RSS/time 非确定性。
- [x] 5.2 将 qualified production graph identity、四图 tsc-only fixture 结果、tool/test graph receipts 和未决 entrypoint blocker 交给 `establish-architecture-fitness-budgets` 与 `enforce-pr-integration-quality-gates`；明确 main/release 不得绕过 tools/test。
- [x] 5.3 明确剩余类型债、外部工具限制和需要后续迁移的共享合同，不 claim 所有 graph 已无债务。
