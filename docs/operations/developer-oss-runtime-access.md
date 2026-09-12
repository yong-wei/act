# 合作者经 ECS 激活网关读取 Runtime

本说明可以随仓库分发。它不含网关令牌、AccessKey、Secret、签名 URL、SSH 私钥或任何可粘贴的凭据。真实网关令牌由维护者通过密码管理器或端到端加密渠道单独发给你，且须在受控网关冒烟通过之后。

开发机**不会**直连杭州公网 OSS，也不会使用 `act-runtime-dev-read` AccessKey。Blob 与媒体文件体都经生产 ECS 上的激活网关进入本机按需缓存。统一 Linux 运行层：

| 你的电脑 | 实际运行位置 |
| --- | --- |
| Linux | 本机直接运行 |
| Windows | WSL2 |
| macOS | Lima 或 Colima 里的 Linux 虚拟机 |

应用、网关 Blob 适配器、物化器和 `npm run startup` 必须在**同一个** Linux 环境里。不要在 Docker Desktop 应用容器里单独跑 FUSE。

## 1. Linux 运行层准备

在 Linux / WSL2 / Lima 中安装：

- 受支持的 CPU 架构（x86_64 或 aarch64）
- `/dev/fuse` 与 `python3-fuse`
- `findmnt` / `mount` / `umount`
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

不要安装面向开发机的 `ossfs2` / `ossutil` 作为默认数据面，也不要配置 `ACT_RUNTIME_OSS_RAM_ROLE`。

检查：

```bash
npm run runtime:dev-preflight
```

失败时不要改用 macFUSE、WinFSP、公网 ossfs2 或其他未验证挂载方式。

## 2. 安装凭据

维护者会单独告诉你密码管理器条目名称（建议：`ACT / developer-runtime-gateway`）。在 Linux 运行层执行：

```bash
npm run runtime:dev-install-credential
```

按提示输入网关 URL（`https://runtime-dev.adapt-learn.online`）和共享令牌。命令会把凭据写到仓库外：

- 目录：`$XDG_CONFIG_HOME/act-runtime-dev-gateway/`（默认 `~/.config/act-runtime-dev-gateway/`）
- 目录模式：`0700`
- 文件：`credentials.json`，模式 `0600`，且必须是普通文件而不是符号链接
- 文件字段只有 `schemaVersion`、`gatewayUrl`、`token`

不要把令牌放进 `.env`、仓库、聊天记录或截图。安装命令的标准输出不含令牌。AccessKey、Publisher、SSH 或 OSS Endpoint 都会被拒绝。

## 3. 启动与停止

```bash
npm run startup:oss-runtime
npm run shutdown:oss-runtime
```

启动顺序是固定的：读取生产 `https://act.adapt-learn.online/api/readyz` 的 active 身份 → 向 ECS 网关申请 pin-time 租约 → 经网关拉取该 Release 的 v2 manifest → 获取本机共享的只读网关 Blob 适配器与磁盘缓存 → 物化**当前 checkout** 的逻辑视图 → 只读覆盖该 checkout 的 `course-content/runtime` → 再调用现有 `npm run startup`。

同一 Linux 运行层上的多个 ACT worktree 共用一个网关 Blob 适配器和一份仓库外缓存；每个 checkout 的 active Release pin、租约、物化 view 和服务进程仍然独立。生产后来切到新 Release，正在跑的开发服务仍可按原租约允许集按需取尚未缓存的 Blob；下次 `startup:oss-runtime` 才会租新的 active。

重复启动时，若共享挂载身份、只读选项和 checkout bind 全部一致，会复用已有状态，不会整树重下。同一 SHA Blob 的第二次读取不应再产生网关体传输；用 `cli.py prove-read` 核对。缓存配额默认 8GiB（`ACT_RUNTIME_DEV_CACHE_SIZE_GIB`）。诊断：`python3 scripts/runtime-release/developer-oss/cli.py status`。共享拓扑细则见 [developer-oss-shared-cache.md](developer-oss-shared-cache.md)。

浏览器从本机开发源读取课程与媒体，不会跳到 `*.oss-cn-hangzhou.aliyuncs.com`。

## 4. 校验

启动成功后：

- 本机 `http://localhost:3001` 能打开课程、媒体和教材相关页面所用的 runtime 文件
- 向 `course-content/runtime` 写入应被文件系统拒绝
- 终端和日志里不应出现网关令牌、AccessKey、Secret 或带签名的公网 OSS URL

身份漂移、readiness 不是 HTTPS、runtime 未 ready、Blob 缺失、公网 OSS 回退或挂载可写，都会在启动前失败关闭。

## 5. 常见问题

**`developer OSS runtime requires the Linux execution layer`**  
你在 macOS/Windows 原生环境里执行了命令。进入 WSL2 或 Lima 后再跑。

**`workstation must not set ACT_RUNTIME_OSS_RAM_ROLE`**  
开发机不要配置生产 ECS 的 RAM 角色。删掉该环境变量后重试。

**`credential schema is unsupported` / `must not contain OSS, SSH or Publisher fields`**  
旧的 `act-runtime-dev-read` AccessKey 不能再用于默认启动。删除旧凭据后安装网关令牌。

**`credential path must stay outside the repository` / 模式不对**  
不要把 `credentials.json` 放到仓库里，也不要把目录/文件改成组或其他用户可读。

**上次启动崩溃**  
先 `npm run shutdown:oss-runtime`。适配器只会回收已证明没有进程、也没有 bind 的 stale lease。若仍提示未知 mount 或可写漂移，按报错给出的精确卸载路径处理，不要递归删其他工作树或共享缓存。

## 6. 项目结束或令牌作废

维护者会先轮换 ECS 上的网关令牌。此后新的启动应被拒绝。然后在本机删除凭据和 checkout 遗留配置：

```bash
rm -f ~/.config/act-runtime-dev-gateway/credentials.json
rm -f ~/.local/state/act-runtime-dev-gateway/checkouts/*/gateway-session.json
```

并卸载仍在的 checkout bind。共享 Blob FUSE 只在没有 live lease 时卸载。共享缓存默认保留到审计窗口结束，不要 `rm -rf` 整个 `~/.cache/act-runtime-dev-gateway/`。不要保留令牌备份在仓库或网盘。

回滚到每 checkout 独立挂载时，先停掉所有共享消费者，再设 `ACT_RUNTIME_DEV_MOUNT_TOPOLOGY=checkout`。该回滚不得删除共享缓存，也不得退回公网 ossfs2。

### 当前指针与租约（2026-09-12）

网关从 `blob-views/current/.act-runtime-release.v2.json` 读取当前身份和文件索引，不读取活动审计回执，也不要求视图内存在发布回执。客户端只获取所选 manifest，不再调用旧 receipt 接口；manifest 的排版差异不影响语义身份。升级网关时，开发者需同步更新启动脚本。

传输凭证默认有效 24 小时，租约允许 7 天没有心跳；恢复后自动续签传输凭证。主动停止、共享凭证撤销和同 checkout 重新启动仍使相应旧租约失效。已签发租约继续读取固定版本，新启动按 current 选择版本。
