## Context

当前 Dockerfile 的 runner 通过复制 builder 文件制造阶段屏障，再安装 Chromium、LibreOffice 和字体/图形库。这确实避免了大型 apt 安装与 Next.js 构建并行，但也让系统层依赖任意应用构建结果。`scripts/build.sh` 同时把 local cache exporter 放在当前工作树 `.cache/buildx`，以 `mode=min` 导出，并通过删除旧目录后移动新目录更新缓存。永久工作树和临时工作树因路径不同无法共享该导出缓存；并发构建或替换中断还可能让缓存指针暂时缺失。

本设计只修复稳定层和本机缓存边界。宿主机与容器内重复 Next.js 构建涉及“谁是发布验证真源”的独立决策；Docker context 缩减涉及动态读取和课程/authority 输入的完整分母，均不在本次修改。

## Goals / Non-Goals

**Goals:**

- 应用源码或 `APP_REVISION` 变化不再使 Chromium、LibreOffice 与系统库层失效。
- 同一主机上的 ACT 工作树按目标平台共享 BuildKit local exporter 缓存。
- 同一平台缓存只有一个写者；失败或中断的构建不替换上一个可用 generation。
- 冷构建先完成 runner 系统层，再开始最终镜像依赖图，保留资源保护。
- 最终镜像内容、revision、tar、sidecar 和现有部署验收保持不变。

**Non-Goals:**

- 不删除宿主机 `npm run build`；后续变更将重新定义轻量 preflight 与容器内唯一完整 Next.js 编译。
- 不修改 `COPY . .` 或 `.dockerignore` 输入分母。
- 不引入远端 registry cache、ECS cache、GitHub CI 或远端构建。
- 不在本次固定 Debian snapshot 或每个 apt 包版本；Node digest 与 `RUNNER_OS_REV` 只把刷新动作变为显式，不宣称 apt 安装结果可逐字节复现。

## Decisions

### 1. 一个固定 Node index digest 供 build 与 runner 系统层共同使用

Dockerfile 声明 `ARG NODE_IMAGE=node:20-bookworm-slim@sha256:...`，`base` 和 `runner-os` 均从该输入派生。使用多架构 index digest 而不是只固定 amd64 manifest，使 Dockerfile 仍可按 `--platform` 选择目标平台；脚本当前正式目标仍是 `linux/amd64`。`BUILD_OS_REV` 与 `RUNNER_OS_REV` 分别进入各自 apt 安装层并写入可检查文件，避免把两套不同用途的系统包误当成一个刷新单元。

仅固定 runner 而保留 builder 浮动会让同一次构建出现不受控的 Node 差异，因此不采用。

### 2. runner-os 完全位于应用依赖图之外

`runner-os` 只读取固定 Node 镜像、`APT_MIRROR`、系统包清单和 `RUNNER_OS_REV`。刷新标识写入镜像内的版本文件，确保该参数实际参与安装层缓存键。用户、HOME 与运行时环境变量仍在最终 runner 阶段配置；任何 `COPY --from=builder` 都只能发生在 `FROM runner-os AS runner` 之后。

保留原先 builder barrier 会继续污染系统层缓存，因此改由构建脚本显式预热，不在 Dockerfile 中制造反向依赖。

### 3. runner-os 预热使用同一 buildx builder 的内部缓存

脚本先确保固定命名的本机 docker-container buildx builder 存在，然后执行一次 `docker buildx build --builder <name> --target runner-os --output=type=cacheonly`，传入与最终构建相同的平台、基础版本和镜像源参数。预热读取共享 external cache，但不单独发布 external cache。随后最终构建显式使用同一 builder，复用刚完成的 runner-os 结果，并在成功时统一以 `mode=max` 导出所有可导出的中间层。

这样避免两个步骤同时写同一 local exporter，也避免为预热层创建额外镜像 tar。

### 4. 主机缓存根按平台隔离，保留显式兼容覆盖

新变量 `ACT_BUILD_CACHE_ROOT` 是共享根。默认值不位于任何 Git 工作树：macOS 使用用户 Library cache，其他系统使用 XDG cache（缺省为用户 `.cache`）。脚本枚举 `git worktree list --porcelain`；无论使用新变量还是兼容覆盖，只要解析后的缓存根位于任一已登记工作树内就失败。目标平台规范化为只含字母、数字、点、下划线和连字符的键，例如 `linux/amd64` → `linux-amd64`。

显式 `CACHE_ROOT` 继续作为兼容覆盖，但其值仍会追加平台目录并接受相同的仓库外校验；不再公开 `CACHE_FROM_DIR`/`CACHE_TO_DIR`，因为任意跨目录组合无法保证单写与原子发布。cache exporter 模式固定为 `max`，不保留可降级为 `min` 的环境出口。

### 5. 缓存以 generation 写入并通过 current 符号链接提交

每次构建在 `<root>/<platform>/buildkit/generations/<revision>-<pid>` 导出新 generation。最终镜像与 exporter 都成功后，脚本在同一目录创建临时符号链接并以 rename 替换 `current`；失败时 trap 只删除本次未发布 generation，旧 `current` 不变。

整个预热、最终构建和指针更新期间持有按平台锁。锁用原子 `mkdir` 实现，以兼容默认没有 `flock` 的 macOS；锁记录 PID，只有确认同主机 PID 已不存在时才回收陈旧锁。不同平台使用不同锁，可并行构建。

### 6. 固定 builder 与稳定 cache mount ID 是独立于 exporter 的下载缓存合同

npm、Prisma 与 apt 的 `RUN --mount=type=cache` 使用带平台后缀的稳定 ID 和 `sharing=locked`。它们由脚本固定选择的同一 buildx builder 在工作树之间复用；apt 层移除 Debian 镜像的自动 `.deb` 清理 hook，并以 cache mount 承载 lists/packages，使层失效时能够复用下载。`mode=max` 主要保证普通中间层导出，不把 cache mount 内容能够跨 builder 恢复写成合同，因为 BuildKit local exporter 不保证导出 cache mount 的可变内容。

### 7. 验收分为静态合同、脚本仿真和一次真实镜像构建

自动化测试解析 Dockerfile 和 build script，验证阶段拓扑、参数参与缓存键、平台隔离、锁、generation 发布、预热顺序与 `mode=max`。脚本测试通过替身 `docker`/`npm`/验证器记录调用，不执行完整构建。稳定修订上再执行一次真实 `scripts/build.sh` 与第二次 runner-os 命中证据；普通单元测试不能冒充真实 BuildKit 缓存命中。

## Risks / Trade-offs

- **[基础系统包仍来自实时 apt 仓库]** → `BUILD_OS_REV`/`RUNNER_OS_REV` 只在明确维护窗口递增，并记录最终镜像验收；如需逐字节基础层复现，另开变更引入 Debian snapshot 和包版本账本。
- **[长期 `mode=max` cache 占用磁盘]** → generation 发布后只保留 current 和有限数量历史 generation；清理仅在持锁状态执行，且不影响当前指针。
- **[陈旧锁误判]** → 锁记录主机名和 PID；只自动回收同主机、PID 不存在的锁，其他情况失败关闭并给出人工处理路径。
- **[`type=cacheonly` 依赖当前 BuildKit]** → preflight 检查 buildx 能力；不支持时明确失败，不静默恢复并行构建。
- **[固定 Node digest 延迟安全更新]** → 基础镜像和 `RUNNER_OS_REV` 升级成为显式、可审核的维护提交，并必须重新执行容器内 Chromium/LibreOffice 与发布验收。

## Migration Plan

1. 增加新 capability、合同测试和脚本仿真测试，先让旧实现在新断言下失败。
2. 重排 Dockerfile 并固定 Node digest，验证 runner-os 目标可独立构建。
3. 实现共享缓存根、平台锁、generation 指针和顺序预热。
4. 运行聚焦测试、OpenSpec strict validation、typecheck 和现有 Docker/部署合同测试。
5. 在明确授权的发布验收窗口执行一次冷/热真实构建并保存 BuildKit 日志；本次代码实现不自动部署。

回滚时恢复旧 Dockerfile 与 `scripts/build.sh`；新主机缓存目录是可删除的派生数据，不参与镜像或发布真源。

## Open Questions

无。移除重复 Next.js 构建和缩小 Docker context 已明确进入后续独立变更。
