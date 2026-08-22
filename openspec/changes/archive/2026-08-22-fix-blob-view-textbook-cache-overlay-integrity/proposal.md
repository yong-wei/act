## Why

生产 blob-view 在激活新 runtime release 后，会为保留知识图谱的宿主机控制面文件而恢复父 view 的普通文件。教材检索热缓存同样是普通文件，因而旧缓存可以在候选 view 通过校验后覆盖新 release 的清单绑定内容，使 hybrid retrieval 失败关闭而 `/api/readyz` 仍报告 runtime 就绪。

## What Changes

- 将宿主机覆盖层恢复限定为显式允许的知识控制面路径，禁止按文件类型泛化复制。
- 在恢复覆盖层后重新验证候选 materialized view；任何清单路径、热缓存或 blob 内容漂移均阻止容器切换与 active lifecycle 提交。
- 为已激活 release 提供受锁的 host view 重建与复验路径，只从其既有 immutable manifest 和只读 blob 重新物化，不发布、覆盖或删除 OSS release。
- 增加覆盖层与教材热缓存共存时的激活回归测试。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `content-addressed-runtime-release-storage`: materialized view 在任何宿主机控制面覆盖恢复后仍必须与同一 immutable manifest 完整闭合。
- `oss-runtime-deployment-bridge`: runtime 激活必须只恢复声明的宿主机控制面覆盖，并在恢复后完成完整性验证后才允许切换消费者。

## Impact

- `scripts/runtime-release/activate-runtime-blob-release.sh` 的覆盖层恢复、激活与失败恢复顺序。
- blob materializer、host-state 校验及其回归测试。
- 已激活生产 blob-view 的受锁修复操作与部署验收；不改变 OSS 发布器、对象权限、runtime release identity 或知识图谱选择器语义。
