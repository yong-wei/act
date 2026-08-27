# 开发机共享 Blob 挂载与持久缓存

冻结基线：`f47c5d455d` 上的 `startup:oss-runtime` 仍为每个 checkout 单独挂载 `runtime/blobs/sha256/`，`cache_root()` 存在但 bootstrap 未配置 ossfs2 持久数据缓存。

## 合格拓扑

- 运行层仍是 Linux / WSL2 / macOS 上的 Linux VM；不支持原生 macFUSE / WinFSP。
- 共享身份由账号、region、公网 Endpoint、Bucket、Blob 前缀、RAM 用户 `act-runtime-dev-read`、adapter schema 与只读 mount 选项摘要构成，与 checkout 路径无关。
- 受支持的 ossfs2 为 **2.0.8+**，使用 `--disk_data_cache_dir` 与 `--disk_data_cache_size`（默认 8GiB，可用 `ACT_RUNTIME_DEV_CACHE_SIZE_GIB` 覆盖）。不要开启会在 umount 时清空缓存的 `del_cache`。
- 仓库外状态：`$XDG_STATE_HOME/act-runtime-dev-read/shared/`；缓存：`$XDG_CACHE_HOME/act-runtime-dev-read/mounts/<id>/ossfs/`。

## 所有权边界

| 共享 | checkout 私有 |
| --- | --- |
| 只读 Blob FUSE、ossfs2 数据缓存、机器锁、lease 表 | readiness pin、manifest/receipt、物化 view、`course-content/runtime` bind、服务进程 |

一个 checkout 的 `shutdown:oss-runtime` 只停自己的服务、bind 和 lease。仍有 live lease 时不卸载共享挂载，也不删除缓存。最后一个 lease 释放后可以卸载 FUSE，缓存与未知数据保留。

回滚到旧拓扑：`ACT_RUNTIME_DEV_MOUNT_TOPOLOGY=checkout`。必须先停掉共享消费者；审计窗口内不得删除共享缓存。

## 二次读取如何证明

不要用“文件已经在 FUSE 里”当作 cache hit。二次读取必须观察 body-transfer 操作类：

- 夹具/验证：`python3 scripts/runtime-release/developer-oss/cli.py prove-read --digest <sha256> --source <blob>`
- 证据文件：`operations.jsonl`，schema `act-runtime-dev-transfer.v1`，字段只有 `opClass` / `sha256` / `sizeBytes` / `at`
- `opClass=oss-body-transfer` 表示一次 OSS 体传输；`cache-hit` 表示本地缓存读
- Linux 上可另读 ossfs2 `--log_dir` 中的 GetObject 行作辅助；含 AccessKey、Signature 的日志行丢弃，不写入证据

真实三平台 FUSE 二次读取仍记在 [smoke 矩阵](developer-oss-runtime-smoke-matrix.md)，与既有受控密钥冒烟同一门槛。
