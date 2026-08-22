## Context

v2 blob-view 将 immutable release 的逻辑文件物化到宿主机 view。为保留生产知识图谱的版本化 `current.json` 等控制面状态，激活脚本会在候选 view 校验后恢复父 view 的普通文件。教材检索热缓存为了避免 ossfs 随机读取退化，也被物化为普通文件；现有恢复逻辑没有区分两者，导致旧 cache 覆盖新 manifest 所绑定的索引文件。

## Goals / Non-Goals

**Goals:**

- 保留已激活知识图谱控制面覆盖而不覆盖教材检索或其他 runtime 数据。
- 在任何覆盖恢复后，以候选 release 的 manifest、materialization receipt 和允许的控制面覆盖共同验证 runtime。
- 为现网 active view 建立不改写 OSS release 的受锁重建与验证流程。

**Non-Goals:**

- 不重新发布、覆盖、删除或重新编号 OSS blob/release。
- 不改变 Authority、Teaching Projection 或五个生产 selector 的业务语义。
- 不放宽教材检索 loader 的哈希失败关闭行为，也不取消热缓存。

## Decisions

### 覆盖层采用显式控制面允许集

覆盖恢复只处理已定义的知识图谱控制面文件及其必要父目录；不再以“父 view 中的普通文件”为选择条件。教材检索目录与 materialization receipt 永远不是覆盖源。允许集比根据后缀、文件权限或“非 blob”判断更窄，避免新增常规文件再次成为隐式覆盖项。

### 覆盖后重新验证

候选 view 在恢复覆盖层后必须执行覆盖感知的 host-state 验证：普通 runtime 逻辑文件与 hot-cache 文件均与候选 manifest 精确匹配；仅显式控制面路径可由已验证的宿主机覆盖取代 Git/blob 基线。验证失败时，不重建 app/worker，不提交 active lifecycle，也不移动 current。

仅在覆盖前验证不足以保证结果，因为覆盖操作本身改变了候选树；仅比较 release ID 或 readiness identity 同样不足以发现缓存字节漂移。

### 现网恢复重建同一 release view

现网修复在 lifecycle lock 内从 active release 的 manifest 和已挂载只读 blob 重新物化 host view，恢复经允许集验证的控制面文件，并在切换消费者前完成覆盖后验证。release identity 与 OSS 对象保持不变；失败时维持原 active/rollback 记录并停止。

## Risks / Trade-offs

- [遗漏既有控制面覆盖] → 允许集与生产真实控制面路径一并测试，并在恢复前枚举拒绝的普通文件。
- [重建期间改变 current] → 复用既有 lifecycle lock、原子 view/current 切换和 rollback 机制，先完成候选验证再替换消费者。
- [完整哈希增加切换时间] → 仅对覆盖影响的路径及现有 materializer/host-state 明确要求的文件执行验证；不得以性能为由跳过教材检索缓存哈希。

## Migration Plan

1. 实现允许集、覆盖后验证和回归测试。
2. 构建并部署应用/运维脚本，不改变 runtime release selection。
3. 在生产 lifecycle lock 内重建当前 active view，恢复允许的控制面覆盖并完成 mounted retrieval smoke。
4. 只有复验、app/worker 只读 bind 与公网 readiness 同时通过后才保留修复结果；失败则恢复此前已验证 view 和 active receipt。

## Open Questions

- None. 生产观测已确认三份旧检索缓存与父 release 精确匹配，且覆盖发生在候选验证之后。
