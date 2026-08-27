## Context

当前根 `tsconfig.json` 使用 `include: ["types/next-env.d.ts", "**/*.ts", "**/*.tsx", ...]`，并只排除了部分 `scripts`、`deploy`、`evaluate`、`data`；测试文件和其他仓库级 TypeScript 仍可能进入同一 Program。`package.json` 的 `typecheck` 通过统一 `tsc --noEmit` 加 heap 参数执行，没有 production/tooling/test 的独立责任边界。

前置 architecture baseline 已将生产、worker、内容/知识/发布工具和测试列为不同编译单元，并要求环境敏感 RSS/time 使用独立 receipt。该 change 与依赖合同共同建立图边界；fitness budgets 后续消费这些图和 receipt，不在此 change 中设定任意内存阈值。

## Hard Dependencies

`capture-modular-monolith-refactor-baseline` 与 `restore-trustworthy-test-command-contracts` 是本 change 的硬前置，二者必须 qualified 且 source identity 可追溯。后续 `enforce-pr-integration-quality-gates` 必须消费本 change 的四张 graph receipts；其依赖方向不回指本 change，保持无环。

## Goals / Non-Goals

**Goals:**

- 让生产 typecheck 只覆盖 Web/worker runtime 需要的 source roots，保持 strict/no-emit。
- 让 tooling、test 拥有独立可运行命令和错误归属，避免测试或脚本改动污染生产信号。
- 让 `typecheck:tools` 与 `typecheck:test` 成为 PR 或 integration 的 mandatory inputs，并要求 main/release 只消费两图通过的 receipts；nightly 不承担补漏。
- 对共享契约建立一个明确编译 owner，并让其他图通过稳定声明或已生成类型消费。
- 让 graph scope、project references、exclude 和编译 receipt 可审计、可重放。

**Non-Goals:**

- 不在本 change 中物理拆 npm workspace、迁移所有业务模块或修复所有既有类型错误。
- 不把编译图拆成第二套领域 owner、依赖图或测试发现系统。
- 不通过增大 `NODE_OPTIONS`、降低 strictness、`skipLibCheck` 扩大或禁用错误来达标。
- 不改变 Next、Prisma、Rust/WASM、worker 或脚本的运行时行为。

## Decisions

### 1. 采用五类明确 program

建立 `tsconfig.base.json` 只承载共享 compiler policy；`tsconfig.web.json` 覆盖 Web/App Router、features、resources、components、hooks 和被 Web runtime 使用的 library；`tsconfig.worker.json` 覆盖正式 worker/scheduler runtime；`tsconfig.tools.json` 覆盖内容、知识、runtime、证据和一次性工具；`tsconfig.test.json` 覆盖 Vitest/Playwright/脚本测试 fixtures。具体 include 由实际 entrypoint 和 baseline 分类生成，不能用仓库根 glob 重新合并。

### 2. 默认 typecheck 代表 production graph

`npm run typecheck` 作为 PR 和 integration 的 production gate，执行 Web/worker production projects 的严格 no-emit 检查；`typecheck:tools` 和 `typecheck:test` 是独立具名命令，并且必须由 PR 或 integration mandatory checks 显式调用。任一图失败、缺失或 receipt 过期都不能 qualify；main/release 必须同时消费两图通过的 receipts，nightly 不能代替这两个强制输入。

### 3. 共享合同只有一个编译 owner

共享 DTO、schema 类型、事件 envelope、manifest/bundle contract 等按 baseline/charter owner registry 归属一个 graph。其他 graph 通过 project references、稳定声明输出或公开 package boundary 消费，禁止在每个 tsconfig 中复制 include 造成多重权威。若共享合同同时被 Web 与 worker 使用，owner 仍唯一，消费者只引用其声明结果。

### 4. 非生产源必须显式被排除或归属

生产 graph SHALL 排除 `scripts/`、`tests/`、OpenSpec、docs、artifacts、logs、evaluate、生成/构建目录、backfill/migration/one-off 工具和测试命名文件。框架约定、动态 import 或构建所需的例外必须有稳定 owner、理由和测试；不允许用宽 glob 再以大量 exclude 伪造边界。production -> tooling/test 的直接依赖使 graph contract 失败。

### 5. 分离确定性图与变量测量

每次 graph command 输出 source roots、excluded roots、file identities、compiler options、project references 和 status 的 deterministic manifest；cold/warm、RSS、duration、Node/OS/cache 等变量信息写入不可变 measurement receipt，并绑定 source revision/tree。receipt 用于后续预算趋势和诊断，不能被写成每台机器必须满足的永久常量。

### 6. 结构性修复优先于 heap

保留合理的 CI 运行内存配置以完成命令，但增加 heap 不是扩大 graph、吞掉测试或恢复旧根 tsconfig 的合规手段。任何 memory relief 必须能由 graph scope、dependency edge、project reference 或 owner 证据解释。

### 7. 每张 graph 都有 tsc-only 失败夹具

为 Web、worker、tools、test 四张 graph 各保留一个只在其对应 `tsc` 命令中可发现的类型错误夹具。运行时测试、lint 或其他 graph 的命令不能使夹具通过；在 gate 验收中注入夹具必须使对应 graph receipt 失败，移除夹具后才可恢复通过。夹具属于质量合同，不进入生产运行路径。

## Risks / Trade-offs

- [Risk] 生产排除规则遗漏正式 worker/Next entrypoint。→ 从 entrypoint inventory 与 build trace 反向验证，缺失 owner 或 runtime caller 使 qualification 失败。
- [Risk] 共享类型被错误归属导致循环。→ 用 owner registry、project references 和依赖 fitness 检查闭合 forward/reverse edges。
- [Risk] test/tools 独立后发现既有类型债务。→ 保留独立命令和 revision-bound receipt，不能将其降级为生产 typecheck 的 accepted failure。
- [Risk] cold RSS 在不同机器波动。→ 只保存 measurement receipt，预算 change 再决定如何消费趋势，不在此 change 固定阈值。

## Migration Plan

1. 在两个硬前置均 qualified 的前提下，重新读取 baseline 的编译 file/edge 清单，核对当前 root tsconfig、Next config、worker/tool/test entrypoints。
2. 建立 base/web/worker/tools/test configs、共享 contract owner 和独立命令，先让生产图保持 strict/no-emit。
3. 逐步将旧 `typecheck` 改为 production aggregate，将工具/测试脚本迁移到具名图，删除根 glob 作为唯一权威和重复 contract include。
4. 为 cold typecheck、tools/test typecheck、每张 graph 的 tsc-only 夹具和 graph scope 生成 receipts，提供给 fitness budget/CI changes；明确 tools/test receipts 是 PR/integration 强制输入。
5. 运行各图命令、受影响领域测试、build/WASM 所需检查和 strict validation；不改变部署或生产状态。

## Open Questions

无。若某 entrypoint 无法归属 production、tooling 或 test，必须先记录 unresolved graph blocker，不能扩大 production include 作为临时解决。
