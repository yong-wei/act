## Context

当前命令入口同时存在 package scripts、`scripts/` 下的 TS/JS/Python CLI、`tools/` release/runtime 工具以及 test/architecture wrappers。已有 toolchain boundary、TypeScript graphs、quality gates 和 release/rollback validator 分别拥有事实；C34 的工作不是再建一个 dispatcher，而是把 active surface 映射到这些既有 owner，并识别 alias/死入口。

## Goals / Non-Goals

**Goals:**

- 生成完整、revision-bound、可复核的 active tooling inventory。
- 为每个 active operation 指定唯一 canonical command、owner、输入/输出、验证命令和 receipt 语义。
- 删除无语义重复 alias，同时保持命令结果、失败码、权限、隐私和非激活边界。

**Non-Goals:**

- 不创建第二套 shell、统一万能 CLI、parallel task runner 或新的 orchestrator。
- 不替换 `verify:commit`、`verify:push`、`typecheck`、release/rollback validator、content/knowledge/runtime toolchain owner。
- 不把质量检查变成生产激活，不部署、不切 selector、不写数据库或生成业务事实。
- 不在业务 waves 尚未稳定时用工具清单宣称全局完成。

## Before / After

### Before

- 同一操作可从多个 package script、wrapper、shell、TS/JS/Python entrypoint 进入，owner、graph scope 和 receipt 要求不总是显式。
- alias 是否仍 active、是否只转发、是否隐含副作用依赖人工记忆和路径猜测。
- 门禁命令和发布/回滚验证存在相似名称，但安全 authority 与非权威观察的界限分散在脚本中。

### After

- 一个 revision-bound inventory 列出 active/compatibility/retired/unknown entries 及其 canonical owner、scope、inputs、outputs、verification 和 deletion condition。
- 每个 operation 只有一个 canonical command；薄 alias 只能转发、保留兼容理由并明确不拥有 authority。
- `verify:commit`、`verify:push`、`typecheck`、toolchain receipts 和 release/rollback unique security validator 的边界清晰且失败原样传播。

## Decisions

### 1. Inventory before consolidation

按 code-simplification skill 的 Chesterton's Fence 原则，先读取脚本、package scripts、调用者和历史使用证据，区分 active、compatibility、retired、generated 和 unknown；没有调用或语义证据的命令不能直接删除。

### 2. Existing owner is the canonical entry

优先复用现有 `scripts/typescript-graphs`、`scripts/architecture*`、`tools/content-knowledge-runtime-release`、`scripts/runtime-release` 和 quality/release command contracts。若多个入口语义相同，保留最靠近事实 owner 的 entrypoint；不把 alias 聚合到新的万能 command。

### 3. Preserve graph, receipt, and security boundaries

inventory 必须区分 Web/worker/tool/test graph，标明 source revision/tree、tracked denominator、receipt and privacy class。`verify:commit`/`verify:push` 是开发交付门禁；release/rollback 唯一安全 validator 是安全 authority；其余检查只能产生观察或质量 evidence，不能冒充激活许可。

### 4. Keep publication non-activating

content/knowledge/runtime publication entrypoint 只能生成 immutable candidate/receipt；生产 selector、部署和 cutover 仍需既有显式 operator transaction。CLI consolidation 不得把 dry-run、write、activate 三种操作合并为不透明命令。

### 5. Make unknowns visible

无法确定 owner、caller、input identity 或副作用的命令进入 `unknown`，阻止自动删除和 qualified inventory。只有经过负责人确认或后续 change 才能改为 active/retired；不能用目录存在或脚本名字证明 active。

## Risks / Trade-offs

- [Risk] 删除 alias 影响外部 operator 或 CI。→ 先查 package/CI/docs/cron/worker caller；短期保留薄 adapter 并有 sunset condition。
- [Risk] inventory 漏掉动态调用。→ 结合静态 import、package script、shell/CI search 和 smoke；unknown 不默认为 retired。
- [Risk] command consolidation 隐藏 graph/receipt failure。→ canonical command 原样传递 exit code、scope、receipt and error identity，禁止宽泛成功包装。
- [Risk] 发布工具误触发 production。→ 继续分离 write/activate，测试 selector 未改变，保留 release/rollback unique validator。

## Migration Plan

1. 确认 C0、C1–C33（按计划）业务 waves 已稳定，冻结 source revision/tree 及 toolchain denominator。
2. 扫描 package scripts、CI、docs、scripts/tools、imports 和运行 smoke，生成 inventory 和 alias equivalence evidence。
3. 在既有 owner 内将 active caller 指向 canonical entries，删除零语义 alias，保留薄 compatibility adapter 并写明删除条件。
4. 验证 `verify:commit`、`verify:push`、`typecheck`、独立 tool/test graphs、release/rollback safety 和 publication non-activation。
5. 运行 toolchain/architecture/quality tests、typecheck、lint、diff 和 strict OpenSpec validation，向 C35 交接 inventory。

回滚只恢复旧 alias 或 script mapping，不恢复第二套 shell/门禁；receipt、selector、部署和数据库状态不被改写。

## Open Questions

无。无法收集到足够调用和副作用证据的入口保持 `unknown`，由后续 owner 处理。
