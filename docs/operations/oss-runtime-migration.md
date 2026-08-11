# ACT Runtime OSS 迁移操作手册

本手册约束 `course-content/runtime` 的第一阶段迁移：runtime 以不可变 Release 存储于私有 OSS，ECS 通过 ossfs 2.0 的只读挂载继续提供既有 Node `fs` 路径。它不授权 Bucket 配置变更、生产切换或删除旧数据。

## 当前基线

- 生产主机根分区为 ext4，容量 52,447,014,912 bytes，已用 45,127,794,688 bytes（91%），可用 4,957,241,344 bytes。
- 本地 runtime 的已分配空间为 5,949,075,456 bytes，10,222 个文件；`lessons`、`knowledge`、`resources` 分别约 3.33 GB、1.40 GB、0.99 GB。Podman images 报告为 15.37GB，其中 2.379GB 可回收，故 runtime 迁移不能被表述为唯一磁盘根因。
- Phase 0 采集时，ECS RAM Role metadata endpoint 返回 404，且尚未安装 `ossfs2`、`ossfs`、`ossutil`。截至 2026-08-11，ECS 已安装 `ossutil` 1.7.19 与 ossfs 2.0.8，并已恢复受限的 `act-runtime-oss-read` 角色；这不授权发布、挂载、切换或删除。
- 机器可读的只读采集结果见 [Phase 0 disk report](../../artifacts/runtime-release/phase-0-production-disk-report-20260811.json)。主工作树 source revision `6ffb506f0334014df5a8304fbbd7ff54c1054e4f` 的媒体盘点见 [media inventory](../../artifacts/runtime-release/phase-0-main-runtime-media-inventory-6ffb506f.json)：121 项声明资源中，96 项 runtime 本地存在、101 项 authoring processed 存在、90 项有 legacy URL、19 项 unresolved。

首次本地 retrieval 基准只代表主工作树源盘，不代表 ossfs：`vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的结果见 [baseline](../../artifacts/runtime-release/phase-0-main-textbook-retrieval-baseline-6ffb506f.json)。候选 ossfs 挂载必须使用同一工具重新测量后才能决定是否启用热缓存。

## 身份与权限

Bucket `act-course-assets` 必须保持私有、阻止公共访问、标准存储与 SSE-OSS。不得将 AccessKey、Secret、STS token 或签名 URL 写入仓库、`.env`、脚本、manifest 或日志。

发布者与 ECS runtime 身份分离：

- 发布者仅需目标前缀 `runtime/releases/<release-id>/` 的 `ListObjects`、`GetObject`、`PutObject`；首阶段不授予删除权限。发布失败留下的对象前缀不可被激活。
- ECS runtime RAM Role 仅需同一前缀的 `ListObjects` 和 `GetObject`。应用的短时媒体签名使用该角色的临时凭据，不向浏览器暴露永久 Bucket URL。

角色绑定完成后，先从 ECS 只读确认 metadata endpoint 返回角色名，再验证 role 对目标 Bucket/prefix 的最小读取能力。不要以长期 AK 作为替代方案。

## 发布、验证与检查

发布命令在保存内容真源的主工作树运行，ECS 只在短时绑定 publisher RAM Role 后充当受限的流式 OSS 写入端；本机不需要、也不得配置 OSS 长期凭据。source runtime 必须来自主工作树的实际目录，而不是 Git tracked 文件集合。

```bash
npx tsx scripts/runtime-release/act-runtime-release.ts plan \
  --runtime-root <main-worktree-runtime> \
  --source-revision <40-char-git-sha>

npx tsx scripts/runtime-release/act-runtime-release.ts publish-streaming \
  --runtime-root <main-worktree-runtime> \
  --source-revision <40-char-git-sha> \
  --release-id <release-id-from-plan> \
  --bucket act-course-assets \
  --ssh-target root@<ecs-host> \
  --remote-bridge-path </absolute/runtime-release-oss-publisher-bridge.py> \
  --known-hosts-file </absolute/known_hosts> \
  --identity-file </absolute/ssh-private-key> \
  --output <verification-receipt.json>

npx tsx scripts/runtime-release/act-runtime-release.ts verify \
  --release-id <release-id> --bucket act-course-assets --region oss-cn-hangzhou \
  --role-name <read-only-runtime-role> --output <verification-receipt.json>

npx tsx scripts/runtime-release/act-runtime-release.ts inspect \
  --release-id <release-id> --bucket act-course-assets --region oss-cn-hangzhou \
  --role-name <read-only-runtime-role>
```

将 bridge 脚本以固定、root-owned 路径部署到 ECS 后，`publish-streaming` 以单个 SSH 流发送 frozen manifest 和缺失对象；ECS 不产生完整 runtime staging 副本。bridge 对每个 Release 前缀持有排他锁，只续传与 manifest 完全一致的既有对象，并在逐对象远端 SHA-256/size 校验后最后写入 manifest。任一中断、额外对象或不匹配都会失败，且不得生成 selection。Release prefix 从不覆盖、从不原地修复。发布结束后立即将 ECS 恢复到 read-only runtime role；`verify` 与 `inspect` 使用该角色重新读取 OSS。

## 候选挂载与切换清单

1. 确认 ECS 绑定 runtime RAM Role，并安装 ossfs 2.0。配置使用 `oss-cn-hangzhou-internal.aliyuncs.com`、`oss_bucket_prefix=runtime/releases/<release-id>/`、`--ro=true` 与显式 uid/gid/file/dir mode。
2. 对 Release 重新执行 `verify`；将 receipt 和 host tools 同步到 ECS。禁止将 runtime 内容 rsync 到 `.staging`、`current` 或 `previous`。
3. 在候选挂载上运行：manifest/逐文件复核、FUSE/read-only 检查、课程资源 smoke、媒体 `/api/course-runtime/assets/...` 短时重定向、`benchmark-textbook-retrieval.ts`。
4. 只有所有候选证据合格，才以显式模式调用部署：

```bash
RUNTIME_DELIVERY_MODE=ossfs-release \
RUNTIME_RELEASE_ID=<new-release-id> \
RUNTIME_EXPECTED_ACTIVE_RELEASE=<none-or-current-release-id> \
RUNTIME_VERIFICATION_RECEIPT=<verified-receipt.json> \
RUNTIME_OSS_RAM_ROLE=<runtime-role> \
scripts/remote-deploy.sh --skip-build
```

宿主机在 `flock` 下把 desired selection 写入 ext4，并在 mount、hash、容器 `/api/readyz` 成功后才写 active receipt。OSS 不使用可变 `current.json`：OSS PutObject 不提供可依赖的 CAS 语义。

## 回退与热缓存

回退必须重新验证目标旧 Release，并传入当前 active release 作为 fence：

```bash
scripts/runtime-release/rollback-runtime-release.sh \
  --release-id <verified-old-release> \
  --expected-active-release <current-release> \
  --verification-receipt <old-release-receipt.json> \
  --ram-role <runtime-role>
```

候选挂载如果造成 retrieval 明显、可重复的读取退化，可运行 `stage-textbook-retrieval-hot-cache.ts`。它只复制三项热索引，目录以 manifest SHA-256 命名并逐文件校验；未出现候选性能回归时不得启用该缓存。

## 删除前的人工确认点

删除旧 ECS runtime 不属于本变更的自动操作。生产 smoke、回退演练和 active receipt 完成后，必须重新采集根分区、Podman、runtime 与可回退 Release 的占用，确认旧 Release 仍可挂载，取得单独人工授权后才可删除。预期可释放的上限是当前 runtime 已分配空间约 5.95GB；实际释放量受文件系统块、仍保留的热缓存和旧目录状态影响。

未解决风险：首个完整 Release 尚未写入并由 read-only runtime role 重新验证、ossfs 候选挂载未验证、ossfs retrieval 性能未知、19 项媒体输入 unresolved。它们不允许生产切换，但不会改变本地 Release 工具和 legacy filesystem fallback 的可用性。
