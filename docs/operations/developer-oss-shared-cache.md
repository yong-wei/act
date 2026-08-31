# 开发机共享网关 Blob 适配器与持久缓存

`startup:oss-runtime` 的默认数据面是 ECS 激活网关。同一 Linux 运行层上的多个 worktree 共享一份只读网关 Blob 适配器和一份仓库外磁盘缓存；每个 checkout 仍独立钉住 readiness 身份、租约和物化 view。

## 合格拓扑

- 运行层仍是 Linux / WSL2 / macOS 上的 Linux VM；不支持原生 macFUSE / WinFSP。
- 共享身份由网关 origin、适配器 schema、Blob 前缀、主体 `act-runtime-developer-gateway` 与只读 mount 选项摘要构成，与 checkout 路径无关。
- 适配器按 SHA 按需 GET `v1/blobs/sha256/<digest>`，支持 HTTP Range；允许集由该 checkout 的 pin-time 租约冻结。
- 仓库外状态：`$XDG_STATE_HOME/act-runtime-dev-gateway/shared/`；缓存：`$XDG_CACHE_HOME/act-runtime-dev-gateway/mounts/<id>/ossfs/`。
- 租约秘密写在 checkout 状态目录的 `gateway-session.json`（`0600`），不得写入 `selection.json`。

## 所有权边界

| 共享 | checkout 私有 |
| --- | --- |
| 只读网关 Blob 适配器、磁盘缓存、机器锁、lease 表 | readiness pin、网关租约会话、manifest/receipt、物化 view、`course-content/runtime` bind、服务进程 |

一个 checkout 的 `shutdown:oss-runtime` 只停自己的服务、bind 和 lease，并向网关声明该 checkout 停止。仍有 live lease 时不卸载共享适配器，也不删除缓存。最后一个 lease 释放后可以卸载 FUSE，缓存与未知数据保留。

回滚到旧拓扑：`ACT_RUNTIME_DEV_MOUNT_TOPOLOGY=checkout`。必须先停掉共享消费者；审计窗口内不得删除共享缓存。不得把数据面改回公网 ossfs2。

## 二次读取如何证明

不要用“文件已经在挂载点里”当作 cache hit。二次读取必须观察 body-transfer 操作类：

- 夹具/验证：`python3 scripts/runtime-release/developer-oss/cli.py prove-read --digest <sha256> --source <blob>`
- 证据文件：`operations.jsonl`，schema `act-runtime-dev-transfer.v1`，字段只有 `opClass` / `sha256` / `sizeBytes` / `at`
- `opClass` 为 `gateway-body-transfer` 或 `cache-hit`
- 返回字节必须匹配声明的 SHA-256；不匹配则失败并不得记为 cache-hit
- Linux 真 FUSE：首次未命中经网关拉字节并写入共享缓存；第二次工作树读取同一 SHA 不得再产生网关体传输
- 非 Linux 夹具只证明适配器记账协议；真实三平台仍走 smoke 矩阵

真实三平台 FUSE 二次读取仍记在 [smoke 矩阵](developer-oss-runtime-smoke-matrix.md)，与既有受控网关冒烟同一门槛。
