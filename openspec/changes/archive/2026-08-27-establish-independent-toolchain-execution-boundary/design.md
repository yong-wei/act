## Context

阶段 3 的编译图与 CI 规约要求产品、worker、工具和测试有独立责任，但仓库目前仍把工具身份隐含在路径和 package script 中。`tsconfig.json` 使用 `**/*.ts`、`**/*.tsx`，只排除了部分 `scripts`、`deploy`、`evaluate` 和 `data`；`vitest.config.ts` 维护一组人工 include；`package.json` 同时暴露内容、ActKG、runtime、QA、迁移和演示命令。工具输出又同时存在于 `course-content/runtime`、`artifacts/`、数据库和 OSS lifecycle 中。

本 change 的事实分母以 `edb98945e78ab0824f801806751fd57f97056347` 为初始观察修订，并严格取该 captured Git tree 的 `git ls-files -- <path>` 结果：`src/lib/teaching-projection` 93 个 tracked entries（其中发布/资格/变基 40 个）、`scripts/knowledge-cutover` 52、`scripts/runtime-release` 32、`course-content/scripts` 41、`scripts/tests` 229、`scripts/migrations` 3、`scripts/db` 76、现有 `tools` 7，以及 `artifacts` 5,528。忽略、未跟踪、生成和运行时文件（包括 `__pycache__/`、`*.pyc`）不进入 source denominator。它们只是 characterization 输入；实现和资格必须在实际 source revision 上重算。未来必须使用的 generated/untracked 输入必须单独标为 `generated-input`，绑定 producer/version、内容摘要和 source revision，不得并入 tracked denominator。

### Captured-tree denominator fixture

The characterization fixture SHALL contain the captured-tree SHA, the exact
`git ls-files -- <path>` entry list (or its content digest), and the counts
above for every source family. It SHALL record ignored/untracked/generated
entries as excluded observations, including `__pycache__/` and `*.pyc`. A
future generated/untracked input fixture is a separate `generated-input` record
with producer/version, path class, digest, and source revision; it never changes
the source denominator.

硬前置 `establish-modular-monolith-refactor-charter` 负责 owner、信任边界和退役台账，`split-production-tooling-test-typescript-graphs` 负责五类 TypeScript graph，`restore-trustworthy-test-command-contracts` 负责 command/receipt 语义。本 change 建立其上的工具执行面，不把三者再实现一遍。

## Goals / Non-Goals

**Goals:**

- 建立一个可发现、可分类、可审计的 `tools/` 执行边界，并覆盖内容、知识/运行时发布、证据/视觉 QA、迁移/回填和比赛材料五类工具。
- 为每个工具命令定义唯一 owner、输入 denominator、公开输出、私有 evidence、source identity、command ID、独立 graph/test receipt 和删除条件。
- 让公开 bundle/manifest/DB result 成为产品消费合同，禁止产品图导入工具实现或运行专用证据。
- 让后续迁移能用 characterization、删除清单和 receipt 证明不是增加 facade，而是减少旧权威入口。

**Non-Goals:**

- 不在本 change 中迁移 Teaching Projection、内容/知识/runtime、迁移或 QA 的实现。
- 不建立 npm workspace，不改现有业务 API、数据库模型、WASM 数值模型或生产发布选择器。
- 不改变 `split-production-tooling-test-typescript-graphs` 的 graph 语义、`commercial-ui-governance-gates` 的通过条件或 `coordinate-latest-authority-and-active-oss-cutover` 的 cutover 合同。
- 不将所有 `artifacts` 机械搬入工具目录；每个 artifact 必须先分类为公开 runtime 输入、确定性 fixture、私有运行输出、审计文档或历史证据。

## Decisions

### 1. 以 `tools/` 作为唯一工具入口，先物理隔离目录，不提前拆 workspace

所有新工具实现进入 `tools/` 下按能力划分的入口（content compiler、knowledge release、runtime release、evidence CLI、migration/backfill、competition）。工具共享的 manifest、receipt、路径和安全 helper 由 boundary-owned public contract 提供。选择仓库内目录而非立即拆 npm workspace，是因为当前需要先证明 owner 和依赖方向；workspace 迁移会把未解决的边界错误变成跨包错误。后续可由单独 change 物理拆包。

现有 `tools/glb-model-optimizer` 只作为已存在的局部工具观察，不被重命名或重写；它必须在 registry 中有明确分类或被记录为不属于本系列的既存工具。

### 2. 用 typed registry 和 command receipt 取代路径猜测

每个工具 registry record 至少包含 `toolId`、`toolClass`、`owner`、`commandId`、`sourceRevision`、`sourceTree`、`inputManifest`、`outputContract`、`safetyMode`、`privacyClass`、`graphId`、`testCommand` 和 `retirementCondition`。每次运行的 receipt 另含输入摘要、输出 manifest 摘要、exit status、validator version、environment/cache observation 和（若有）approval/DB target identity。

工具路径可以变化，但 registry identity、公开 output contract 和删除条件不能靠目录名隐含。未知分类、重复 owner、缺失输入分母、绝对路径或未经声明的外部输入均 fail closed。

### 3. 严格分离公开产品输入与私有运行证据

公开输出仅包括可供 runtime/DB consumer 读取的 bundle、manifest、稳定投影或已验证数据库结果；它们必须使用 repository-relative/URI-safe path、内容摘要和 immutable identity。截图、trace、浏览器 HAR、完整 review pack、日志和失败诊断属于私有 run evidence，默认写 CI artifact 或对象存储；仓库只留 manifest、必要的小型代表 fixture 和 receipt。

产品运行时只读公开 contract，不读取工具工作目录、staging 目录、run ID 目录或私有 artifact。发布工具可写公开输出，产品没有反向 import 权限。

### 4. 工具验证复用既有 graph 和 command authority

每个工具入口必须映射到 `split-production-tooling-test-typescript-graphs` 的 `tools` graph，并通过其具名 typecheck；工具测试使用 `typecheck:test`/工具专属测试发现合同，结果交给 `restore-trustworthy-test-command-contracts` 的 receipt schema。此处只登记 mapping 和产品依赖拒绝，不创建第二个 tsconfig、Vitest include 或 CI required-check 体系。

### 5. 迁移必须同时有删除和回滚证据

每一条旧入口记录 current owner、调用者、replacement、删除条件、回滚方式和 source identity。迁移完成时必须删除本 change 引入的无用 facade/forwarder，并更新 registry/receipt；若旧路径仍被必须保留的生产 adapter 使用，则记录为有期限的 compatibility entry，而非声称已隔离。任何公开输出切换都保留上一份 immutable manifest，回滚只改变消费指针，不改写工件。

### 6. 五类工具是分类，不是五套数据 authority

内容导出审查、知识图谱发布、OSS runtime 发布、证据/视觉 QA、迁移/回填和比赛材料都共用同一套 tool registry、path/receipt/privacy 合同。ActKG、ACT Teaching Projection、course-content runtime、Runtime Release lifecycle、商业 UI gate、数据库 schema 和 Arena submission spec 仍各自保持原 authority；boundary 不得复制这些业务规则。

## Risks / Trade-offs

- [工具 registry 变成另一套手工清单] → 从一次 revision-bound inventory 生成，校验 tracked source entries、文件/命令/调用者双向闭合；未知或重复记录阻断 qualification。
- [产品为了方便继续 import 工具] → 在 build/typecheck 与架构测试中检查 product-to-tools reverse edge，并对动态 import、路径读取和 JSON fixture import 统一 fail closed。
- [公开 bundle 混入隐私或运行路径] → 输出 manifest 只允许可移植逻辑路径与摘要；私有证据只能通过 evidence reference 消费，不得被 runtime resolver 读取。
- [工具独立后既有类型债暴露] → 保留独立 tools/test receipt 和 blocker，不以扩大 production graph、`skipLibCheck` 或 heap 规避。
- [过早移动导致已有发布合同失效] → 本 change 只定义 boundary；后续五个 change 必须逐项 characterization、迁移、删除、验证，并复用各自 canonical spec。

## Migration Plan

1. 冻结当前 source revision、工作树 clean proof、脚本/工具/artifact denominator 和现有 owner/caller 图；生成未分类和重复入口清单。
2. 定义 tool registry、command receipt、公开 output manifest、private evidence reference、路径/隐私规则和 graph mapping，并用样例输入验证 deterministic serialization。
3. 建立 `tools/` 基础入口与 product-to-tools 反向依赖检查；只接入无业务副作用的 contract/validation smoke，不迁移现有实现。
4. 将 boundary identity、registry、删除清单和验证 receipt 交给四个后续迁移 change；每个后续 change 单独删除旧 authority，不在本 change 中修改生产或数据库。
5. 若 boundary 校验失败，保留旧运行路径和当前生产 selector，回滚只移除新 registry/入口；不得以未验证的 facade 宣称完成。

## Open Questions

无需在本 change 中决策 workspace 拆分、对象存储供应商或生产 CI 规则；这些分别由实现和后续 CI/release change 以实际环境证据决定。若任一现有脚本同时承担产品运行和工具发布，必须在 characterization 中拆成明确的 adapter 与 tool owner 后才能迁移。
