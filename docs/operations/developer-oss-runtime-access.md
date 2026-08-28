# 合作者只读 OSS Runtime 接入说明

本说明可以随仓库分发。它不含 AccessKey、Secret、签名 URL 或任何可粘贴的凭据。真实密钥由维护者通过密码管理器或端到端加密渠道单独发给你。

开发机**不会**在 macOS / Windows 原生 FUSE 上挂载 OSS。统一 Linux 运行层：

| 你的电脑 | 实际运行位置 |
| --- | --- |
| Linux | 本机直接运行 |
| Windows | WSL2 |
| macOS | Lima 或 Colima 里的 Linux 虚拟机 |

应用、`ossfs2`、物化器和 `npm run startup` 必须在**同一个** Linux 环境里。不要在 Docker Desktop 应用容器里单独跑 ossfs2。

## 1. Linux 运行层准备

在 Linux / WSL2 / Lima 中安装：

- 受支持的 CPU 架构（x86_64 或 aarch64）
- `/dev/fuse`
- `ossfs2`、`ossutil`、`findmnt`/`mount`/`umount`
- 非 root 时，安装仓库提供的路径受限 helper，**不要**把整个 `mount`/`umount` 放进 `NOPASSWD`：

  ```bash
  sudo install -o root -g root -m 0750 \
    scripts/runtime-release/developer-oss/privileged-mount.py \
    /usr/local/sbin/act-runtime-dev-mount
  echo "$USER ALL=(root) NOPASSWD: /usr/local/sbin/act-runtime-dev-mount" | sudo tee /etc/sudoers.d/act-runtime-dev
  sudo chmod 440 /etc/sudoers.d/act-runtime-dev
  sudo visudo -cf /etc/sudoers.d/act-runtime-dev
  ```
- Python 3、Node.js（与仓库 `engines` 一致）
- 本仓库的可写 checkout

检查：

```bash
npm run runtime:dev-preflight
```

失败时不要改用 macFUSE、WinFSP 或其他未验证挂载方式。

## 2. 安装凭据

维护者会单独告诉你密码管理器条目名称（建议：`ACT / act-runtime-dev-read`）。在 Linux 运行层执行：

```bash
npm run runtime:dev-install-credential
```

按提示输入 RAM 账号 ID、AccessKey ID 和 Secret。命令会把凭据写到仓库外：

- 目录：`$XDG_CONFIG_HOME/act-runtime-dev-read/`（默认 `~/.config/act-runtime-dev-read/`）
- 目录模式：`0700`
- 文件：`credentials.json`，模式 `0600`，且必须是普通文件而不是符号链接

不要把密钥放进 `.env`、仓库、聊天记录或截图。安装命令的标准输出不含 Secret。

## 3. 启动与停止

```bash
npm run startup:oss-runtime
npm run shutdown:oss-runtime
```

启动顺序是固定的：读取生产 `https://act.adapt-learn.online/api/readyz` 的 active 身份 → 校验该 Release 的 v2 manifest/receipt → 获取本机共享的只读 `runtime/blobs/sha256/` 挂载与 ossfs2 数据缓存 → 物化**当前 checkout** 的逻辑视图 → 只读覆盖该 checkout 的 `course-content/runtime` → 再调用现有 `npm run startup`。

同一 Linux 运行层上的多个 ACT worktree 共用一个 Blob FUSE 和一份仓库外缓存；每个 checkout 的 active Release pin、物化 view 和服务进程仍然独立。生产后来切到新 Release，不会热更新正在跑的开发服务；下次 `startup:oss-runtime` 才会跟过去。

重复启动时，若共享挂载身份、FUSE、只读选项和 checkout bind 全部一致，会复用已有状态，不会整树重下。同一 SHA Blob 的第二次读取不应再产生 OSS 体传输；用 `cli.py prove-read` 核对，不要把“文件在挂载点上”当成 cache hit。缓存配额默认 8GiB（`ACT_RUNTIME_DEV_CACHE_SIZE_GIB`）。诊断：`python3 scripts/runtime-release/developer-oss/cli.py status`。共享拓扑细则见 [developer-oss-shared-cache.md](developer-oss-shared-cache.md)。

## 4. 校验

启动成功后：

- 本机 `http://localhost:3001` 能打开课程、媒体和教材相关页面所用的 runtime 文件
- 向 `course-content/runtime` 写入应被文件系统拒绝
- 终端和日志里不应出现 AccessKey、Secret 或带签名的 URL

身份漂移、readiness 不是 HTTPS、runtime 未 ready、Blob 缺失或挂载可写，都会在启动前失败关闭，不会回退到本地残留 runtime。

## 5. 常见问题

**`developer OSS runtime requires the Linux execution layer`**  
你在 macOS/Windows 原生环境里执行了命令。进入 WSL2 或 Lima 后再跑。

**`caller identity is not the dedicated developer reader`**  
装错了 Publisher 或其他 RAM 用户。删除凭据文件后重新安装 `act-runtime-dev-read`。

**`credential path must stay outside the repository` / 模式不对**  
不要把 `credentials.json` 放到仓库里，也不要把目录/文件改成组或其他用户可读。

**上次启动崩溃**  
先 `npm run shutdown:oss-runtime`。适配器只会回收已证明没有进程、也没有 bind 的 stale lease。若仍提示未知 mount 或可写漂移，按报错给出的精确 `umount`/`fusermount -u` 路径处理，不要递归删其他工作树或共享缓存。

**损坏的单个 Blob 缓存**  
验证失败时只隔离该 SHA 条目并要求重新读取，不会清空整个 `ossfs` 缓存目录。

## 6. 项目结束或密钥作废

维护者会先删除 AccessKey。此后新的挂载应被拒绝。然后在本机删除凭据和 checkout 遗留配置：

```bash
rm -f ~/.config/act-runtime-dev-read/credentials.json
rm -f ~/.local/state/act-runtime-dev-read/checkouts/*/ossfs.conf
rm -f ~/.local/state/act-runtime-dev-read/shared/mounts/*/ossfs.conf
```

并卸载仍在的 checkout bind。共享 Blob FUSE 只在没有 live lease 时卸载。共享缓存默认保留到审计窗口结束，不要 `rm -rf` 整个 `~/.cache/act-runtime-dev-read/`。不要保留密钥备份在仓库或网盘。

回滚到每 checkout 独立挂载时，先停掉所有共享消费者，再设 `ACT_RUNTIME_DEV_MOUNT_TOPOLOGY=checkout`。该回滚不得删除共享缓存。
