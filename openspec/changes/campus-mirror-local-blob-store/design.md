## Context

双镜像形态（阿里云 ECS + 校内 202.195.195.153）已上线，首次克隆正在进行：应用镜像取自阿里云导出 tar（原本机构建镜像已清理），runtime 以 ECS blob-view 解引用快照全量搬运。校内网络事实（2026-11-04 实测）：出站 TCP 全禁，阿里云→校内 22/443 被拦，校内 22/80/443 仅校园网内可达；发布机（macOS）位于校园网内。现有 v2 发布链：本机 `runtime:publish` 计算 Δ 与不可变 manifest → OSS 条件 PUT → ECS ossfs 只读挂 blob 根 → materializer 物化 view → `runtime:activate` 切指针。

## Goals / Non-Goals

**Goals:**
- 校内 runtime 与 OSS 通道同 manifest、独立事务、纯增量（按 SHA-256 命名跳过已有 blob）
- 校内同步路径为"发布机 → 校内"直推，与阿里云、OSS、任何出站白名单解耦
- 复用现有 materializer / activate / doctor 的 blob-root 参数化能力，不复制第二套物化实现
- 双端 receipt 分账，验收证据同源（同一 manifest digest）

**Non-Goals:**
- 不修改 OSS 通道任何现有合同（`oss-runtime-release-management`、`content-addressed-runtime-release-storage` requirements 不变）
- 不做校内 garbage collection（blob 只增不删）
- 不改变应用镜像构建链路；不做校内源码构建
- 不引入数据库同步策略变更（数据库走既有 dump→灌入流程）
- 不处理非 runtime 的 ESA 公开媒体分发

## Decisions

1. **本地 blob-store 而非校内 ossfs**：校内无法出网，ossfs 方案需要申请 endpoint 白名单且引入 FUSE/角色运维面；本地目录 + CAS 命名即可获得与 OSS 相同的不可变语义与增量性。放弃"申请 OSS 白名单"备选。
2. **发布机直推为唯一校内通道**：本机在校园网内、是 manifest 的产生点，新增 blob 在本机即可获得（按 manifest 从 Git 树或本地缓存填充）；避免"从 ECS 拉 ossfs 再转推"的二跳浪费。备选"经 ECS 中转"仅在发布机不在校园网时使用，记录为回退路径。
3. **姊妹命令而非改动 `runtime:publish` 本体**：新增 `runtime:publish:campus`（或等价 `--target campus`）承载"填 blob → rsync → 校内物化 → smoke → 切指针 → receipt"。`runtime:publish` 的 OSS 合同、CAS hit 判定、SQLite 索引 fail-closed 语义零改动，降低对既有发布线的回归面。
4. **校内物化复用 `materialize-runtime.py` 的 `blob_root` 参数**：以本地 `data/runtime/blob-store` 为 blob root，staging view + 原子 rename 切 current，选择器/锁语义与 ECS 相同；不 fork 物化代码。
5. **首次结构重建允许以现有解引用快照为内容源**：重建到标准结构后，快照即退役；此后同步单元永远是"缺失 blob 集合 + manifest"，禁止再次全量解引用打包。
6. **rsync 语义**：`rsync -a`（保留链接结构、按名字+尺寸+mtime 快速比对）推送 blob-store 与 `blob-releases/<id>/manifest.json`；`--partial` 支持断点；发布侧在推送前后各做一次 manifest 文件数/字节数核对。

## Risks / Trade-offs

- [校内 blob-store 无 OSS 侧的对象级 CAS PUT 保护，误写依赖传输纪律] → blob 名即内容哈希，落盘后物化必验摘要；同步通道只允许发布机写入；容器侧只读 bind。
- [双端 release 状态漂移（一侧 activate 一侧未跟）] → 双端 receipt 分账 + 部署技能要求发布后核对两端 active release id；漂移只提示不阻塞另一端。
- [校园网内发布机不在线时校内滞后] → 接受滞后（镜像站定位）；ECS 恒为权威端；补同步幂等可随时追平。
- [首次结构重建期间校内服务中断] → 重建在 staging 目录完成后原子切换；以现有快照 view 作为回退。

## Migration Plan

1. 首次克隆（进行中）完成：应用容器以解引用快照 view 运行。
2. 实施本变更：校内建标准结构，以快照内容回填 blob-store（按 SHA-256 重算命名），materializer 产出标准 view，原子切换，快照退役。
3. 发布侧接入姊妹命令与双端核对；此后每次 `runtime:publish` 后按需推校内（增量）。
