## Context

生产 ECS 当前把 `/home/projects/act/course-content/runtime` 以只读 bind mount 提供给 `/app/course-content/runtime`。该目录约 5.93 GB、10,222 个文件；根文件系统 49 GB 已使用 43 GB（91%）。现有 `scripts/remote-deploy.sh` 会把完整 runtime rsync 到 `.staging`，rename 到正式目录，并在过程中保留 previous，因而不适合对象存储挂载。

主工作树的 runtime 是本次内容真源，且整体被本地 exclude；发布器必须对实际目录生成内容快照，而不能只用 Git tracked files。当前源盘点得到 7,282 个媒体文件、5.36 GB；31 份课程媒体索引声明 121 项资源，其中 96 项存在 runtime 本地文件、101 项存在 authoring `processed` 文件、90 项带 legacy 外链、19 项没有 runtime/processed/外链来源。这个分类是迁移输入审计，不把历史外链自动认定为可下载。

生产 ECS 已验证受限 RAM Role、ossfs 2.0.8、ossutil 1.7.19 与独立固定的 ossutil 2.3.0；这只解除首个不可变 Release 的受控发布前提。Bucket 仍保持私有、SSE-OSS、阻止公共访问；挂载、选择器切换与 ECS legacy runtime 删除仍需独立证据和明确授权。

## Goals / Non-Goals

**Goals:**

- 把实际 runtime 目录封装为具有逐对象内容身份的 immutable release。
- 在不改变 Node.js `fs` 读取路径的前提下，用 ossfs 2.0 只读 release-prefix 挂载取代生产 runtime 的 rsync/staging/previous 复制。
- 将课程媒体从长期外链逐步过渡到 release-bound OSS 对象，并用短时签名重定向对浏览器交付私有对象。
- 让发布、验证、选择、激活、回退和 hot-cache 性能证据可单独审计。

**Non-Goals:**

- 本变更不执行生产 Bucket 写入、ECS 挂载、容器切换、旧 runtime 删除、Docker 发布或 CDN 配置。
- 不把 Node fs runtime consumers 批量重写为 OSS SDK consumers。
- 不改变 Bucket 的公开访问、加密或存储等级，不写入长期 AK/Secret。
- 不把没有本地或 processed 真源的外链资源伪造为已迁移媒体。

## Decisions

### 1. Release 是不可变对象前缀，实际 source snapshot 是内容权威

每个 release 只写 `runtime/releases/<release-id>/`。发布器从显式 `--runtime-root` 遍历常规文件，拒绝 symlink、设备文件、路径穿越、重复规范化路径和目录外输入；产生 canonical JSON `act-runtime-release.v1`，包括 Git revision（作为上下文）、源目录 digest、文件集合、每文件 size/SHA-256、总 bytes 和 tree digest。`.DS_Store` 等无业务意义的本地元数据不进入输入；其余 ignored runtime 内容必须进入 manifest，避免以 Git ignore 静默漏发媒体或索引。

`release-id` 固定为 `runtime-` 加 `SHA-256(canonical({sourceRevision, treeSha256}))` 的前 55 个十六进制字符。不同 source identity 不会竞争同一前缀（除密码学碰撞外）；相同 identity 的并发重试只会写入同一 canonical 对象集合，发布方仍必须将远端重新验证 receipt 与其提交的 manifest/tree digest 精确比对。此规则不依赖 OSS 对象的条件写能力。

发布顺序是生成 manifest → 上传独占 release prefix → 基于 OSS 对象完整重验 → 允许候选挂载。OSS ETag 不承担内容哈希身份，multipart 与服务端加密都不能替代 SHA-256。

2026-08-11 的真实 preflight 表明，ECS 现有 legacy runtime 虽标注同一 source revision，但其 tree SHA-256 与主工作树内容真源不同，且主机无空间保留另一份完整 staging。首发固定使用受限的主工作树→SSH→ECS publisher transport：本机只读取已冻结 manifest 所列文件；ECS 在 release 锁内至多为一个对象建立受限临时文件，再以服务端条件写入 OSS，随后立即精确删除该文件。临时文件上限为 256 MiB，发布前验证 manifest 全部对象低于该上限，并在每次落盘前预留至少 1 GiB 空间；它不是 runtime staging。该 transport 不得读取、覆盖或替换正在服务的 legacy runtime，也不具有选择、挂载或重启能力。

传输只接受经过 manifest 验证的路径和对象键，SSH 不是命令解释边界。每个对象流入临时文件时比较本地读取的 size/SHA-256；只有精确匹配才调用 OSS 服务端条件写，随后由独立读取路径完整重验 size/SHA-256。manifest 必须最后写入。若传输中断，未带 manifest 的前缀永久不可激活；同一 content-addressed release 仅可在已存在对象逐项精确等于 manifest、没有多余对象且尚无 manifest 时恢复补传，禁止覆盖任何对象。任一不匹配或多余对象都会失败关闭，且不得用删除或覆盖修复。

独立 Sol medium 的整改裁决确认：第一阶段仅允许 bridge 取得发布写能力。原有 direct `publish` CLI 必须停用，避免无条件 `PutObject` 绕过单写者边界。bridge 对每个 release identity 在 ECS 本地持有独占 `flock`，覆盖 prefix 检查、partial 精确恢复、上传、逐对象复验和最终 manifest 复验的完整事务；有效 manifest 是终态，后续相同或不同请求均不得 PUT。`manifestSha256` 继续表示不含该字段的 canonical body 摘要；传输另计算最终序列化 manifest 文件的 `wireSha256`，两者不得混用。该锁只承诺单 ECS 的唯一受控写入口，不作为多发布者或存储层不可变性声明。

2026-08-11 的生产工具验证确认 ossutil 1.7.19 不能可靠消费 stdin，且 ossutil 2.3.0 的普通 `cp -` 不提供禁止覆盖保证。writer 因而固定为已校验的 `/opt/act-ops/ossutil-2.3.0/ossutil`，通过 `api put-object --body file://… --forbid-overwrite true` 写入；bridge 在每次调用前经 IMDS 验证唯一的 `act-runtime-oss-publisher`，并显式提供 `EcsRamRole`、杭州内网 endpoint 与 `cn-hangzhou` region。v2 JSON API 是主集合验证来源；`/usr/local/bin/ossutil` 1.7.19 仅以 `ls <prefix> -s` 进行独立只读 key-set 交叉检查。`rtk` 的显示层会截断长行，不能作为远端响应证据。

首个完整 Release 已在 source revision `3097ebc204d65b2722cfdc1423e0d1646e37d55d` 发布为 `runtime-b2f0b07c428faba4317bf2f5b7ad51f0858165dee8651fcea52eb6a`。bridge receipt 绑定 10,222 个文件、5,924,691,879 bytes、tree digest `2fd9eec21142994ea97bf971225b1ad24a85ee6346ec17d8ff96d2da93708133`、semantic manifest digest `75912510df1f3e9b89801702dea9747ce15e0af117317886dabc9965b760f326` 和 wire digest `fc6ead8721b950731a866d652a01020ea5626b741c06af98f4264891d13ed88f`。该回执不选择 runtime，发布后仍须恢复 read-only role，并完成 ossfs candidate、性能、container smoke 与 rollback 证据。

### 2. 选择器在 ECS 本地 durable storage，而不是 OSS current object

独立 Sol medium 决策顾问最初建议 `runtime/current.json` 作为期望选择器，但新证据表明 OSS `PutObject` 不支持 `If-Match`、`If-None-Match` 或其他条件写，不能用它实现可靠 CAS。第一阶段改用 ECS ext4 上的 `data/runtime/act-runtime-selection.json`；该文件由固定运维脚本在 `flock` 下原子写入，记录 release id、manifest digest、单调 generation 和 operator intent。`data/runtime/act-runtime-active-receipt.json` 单独记录真正健康运行的版本。

这满足“production pointer switch”要求：指针切换发生在远端对象完整验证和候选挂载验证之后，并且实际活跃态不会从期望态推断。它也保持 OSS 全部对象不可变，避免无 CAS 的最后写入者覆盖。将来增加多 ECS 或 CDN 时，再以具备 compare-and-set 或租约语义的控制面取代本地选择器。

### 3. ossfs 挂载固定 release prefix，容器只绑定绝对路径

为每个候选 release 建立独立的 systemd ossfs 2.0 实例，使用 `oss-cn-hangzhou-internal.aliyuncs.com`、`act-course-assets`、`oss_bucket_prefix=runtime/releases/<release-id>/` 和 ECS RAM role。mount path 由经过白名单验证的 release id 计算，不使用 symlink 或 OSS rename。验证通过后，Podman 的 `RUNTIME_CONTENT_DIR` 设置为该挂载的绝对路径并只读 bind 到既有应用路径。

ECS runtime role 仅得到 bucket/prefix 受限的 `ListObjects` 与 `GetObject`；发布身份独立拥有必要上传权限。候选 mount、容器 restart 或 health check 失败时旧 container 与旧 active mount 均保持，receipt 显式记录 desired/active divergence。

### 4. 媒体使用 manifest-bound object metadata 与短时 resolver

release manifest 为每个 runtime 文件提供 object key、SHA-256 和 size。课程媒体投影保留 `legacyUrl`，并在对象存在时把实际播放 URL 改为同源 `/api/course-runtime/assets/<path>` resolver；该路由只能从 active manifest 精确解析允许交付的媒体路径，再借助 `@alicloud/credentials` 和 `ali-oss` 从 ECS RAM role 在进程内取得短期凭据并生成短时公网 OSS 签名 URL。客户端不会得到永久 Bucket URL，路由不接受任意 objectKey。

不存在 manifest object 时维持 legacy URL；没有任何 local/processed/legacy 来源时保持 unresolved。直接 `/course-runtime` 路由仍提供非媒体 runtime 的 fs compatibility，并继续拒绝治理、文本检索与 manifest 文件。

### 5. Textbook retrieval 允许以 digest 绑定的本地只读热缓存

`vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的候选 mount 先跑固定 benchmark，记录 cold/warm 启动和代表性 lookup。只有结果超过配置阈值，才允许把这些确切对象复制到 bounded local cache；缓存目录包含 manifest digest，任何 mismatch 直接拒绝复用。目的不是形式上的全量 OSS，而是降低课程检索回归风险。

## Risks / Trade-offs

- [ECS 无 RAM role 或 ossfs] → 本地实现可以完成，生产写入与激活保持阻断；人工绑定 role 后先运行无凭据 probe 和最小 mount 验证。
- [OSS 不支持 PutObject CAS] → 第一阶段使用同一 ECS 的 `flock` 本地选择器；多主机部署前不得假定它是分布式协调。
- [ECS 单对象 spool] → 单 release 锁内只允许一个 0600 临时文件，256 MiB 上限与 1 GiB 剩余空间门槛阻止其退化为完整 staging；可捕获失败精确删除，强杀残留下一次明确报告并失败关闭。
- [ossutil writer 覆盖语义] → 普通 `cp -` 不作为 writer；仅 v2 `api put-object --forbid-overwrite true` 可以写入，v2 JSON 主集合与 v1 `-s` 独立 key-set 均须闭合。
- [ECS legacy runtime 与内容真源漂移] → 以主工作树 frozen manifest 为唯一发布输入，通过流式 transport 发送；禁止因 source revision 相同而把 ECS 目录当成等价源。
- [FUSE 大量小文件或热索引退化] → 保持 release prefix mount 并以基准证据决定 bounded digest-pinned hot cache。
- [签名 URL 泄露或过期] → 使用短 TTL、只签 manifest allowlist 对象、不写日志；客户端将 403/过期视为重新解析而不是 fallback 到永久 URL。
- [对象前缀缺少 Bucket WORM] → immutable 是发布协议约束；若未来需要存储层不可改写，另行启用并验证版本化/WORM。
- [媒体外链不可下载] → 只标记 unresolved，保留 legacy fallback，不创建占位对象。

## Migration Plan

1. 绑定并验证 ECS runtime RAM role；角色仅能读取 `act-course-assets/runtime/*`。为独立发布身份授予最小写入权限，且不放入 ECS 或仓库。
2. 安装经验证版本的 ossfs 2.0；先挂载 disposable candidate prefix，完成 manifest、读取、Podman bind 与 retrieval benchmark。
3. 从主工作树 runtime 生成并发布首个 release；远端重验对象集合和摘要，记录 source revision/manifest digest。
4. 在 ECS lock 下写 desired selection，建立 candidate mount，重启容器并运行 health、课程路由、媒体 redirect 与 retrieval smoke；成功后写 active receipt。
5. 观察生产 smoke 后输出 runtime、Podman、镜像和 rollback 占用；只有得到用户的第二次删除授权才清理旧 ECS runtime。
6. 回退时重新验证旧 release，走同一 selection/mount/health 流程；不修改 release prefix。

## Open Questions

- 人工待办：创建并绑定 ECS RAM role，并提供角色名以核对 metadata token；当前 404 是生产激活的硬阻断。
- 人工待办：确认发布身份的受控运行位置；本仓库不创建或保存其长期 credential。
- 性能阈值将以 candidate mount 的首次 benchmark 作为基线后写入 deploy 参数，避免在未测 ossfs 延迟时猜测固定毫秒阈值。
