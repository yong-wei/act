# Runtime Blob 物化等价性矩阵

## 范围

本矩阵适用于生产容器可见的 `course-content/runtime`。它覆盖应用路由、课程加载、媒体解析、教材检索、发布验证和运行态审计；作者态生成脚本及不进入生产容器的构建输入不属于本次物化资格判断。

候选实现采用真实目录加受控叶文件链接：运行态根目录、所有逻辑目录和本地兼容 manifest 都是物理目录或普通文件；每个逻辑文件是只读链接，目标只能是同一主机、同一候选事务锁定的只读 blob 挂载中的 SHA-256 blob。应用、容器和 URL 不得看到 blob 路径。

这种方案尚未通过资格验证。任何矩阵项失败都禁止 v2 生产选择，保留 v1 运行态。

## 已审计的消费者

| 消费者 | 观察到的文件系统行为 | 对 symlink forest 的要求 | 资格验证 |
| --- | --- | --- | --- |
| `scripts/runtime-release/runtime-release-host-state.py` | 根目录 `resolve`、manifest `is_symlink`、`os.walk(followlinks=False)`、`stat`、代表文件哈希 | 当前实现拒绝全部链接，必须改为允许并逐项验证受控叶链接；目录链接、挂起链接、根和 manifest 链接始终拒绝 | 伪造目录链接、越界链接、错误 SHA、遗漏/额外路径分别失败；正常候选全量路径和代表哈希通过 |
| `src/lib/runtime-content-path.ts` | 词法路径规范化和根目录相对路径检查，随后 `readFile` | 根目录必须是真实目录；叶链接目标受物化器限定在 blob 根内，防止词法检查之后逃逸 | 有效 Markdown、`..`、反斜杠、绝对路径和越界 blob 目标分别断言 |
| `src/lib/course-runtime.ts` | `readdir({ withFileTypes: true })` 发现课程目录，`access`、`readFile` 读取 lesson、讲义、媒体索引和互动 manifest | `lessons/*` 等目录必须是物理目录，叶链接可被正常打开 | 已发布课程枚举、`loadLessonRuntimeEntry`、讲义打印和互动 manifest 在候选根运行 |
| `src/app/api/content/mdx/route.ts` 与讲义打印页 | 经 runtime-content-path 读取 Markdown | 与上行相同，不允许 URL 输入越界 | 合法 MDX/讲义返回内容，非法路径为 400/404 |
| `src/app/course-runtime/[...assetPath]/route.ts` | `normalize`、根前缀检查、`readFile` 提供公开非治理资源 | 根目录真实；资源叶链接只能指向被 manifest 绑定的 blob | 课程图片/PDF/媒体成功；私有治理路径和路径穿越拒绝 |
| `src/lib/runtime-active-release.ts` 与媒体签名路由 | 读取本地活动 manifest，以 manifest 作为唯一媒体 allowlist | 本地兼容 manifest 必须是普通文件，并同时绑定 v2 semantic/wire/tree identity；叶 blob key 只能由 SHA 推导 | 活动身份不一致、未知媒体、篡改 object key、过期签名和 legacy URL fallback 分别验证 |
| `src/lib/runtime-release-media-closure.ts` 与 `scripts/runtime-release/verify-runtime-release-media-closure.ts` | 遍历课程目录、`stat` 媒体叶、比对 manifest | 课程/媒体目录真实，叶链接解析后 size 与 hash 必须匹配 | 已发布课程媒体闭包和外链 fallback 在候选根复验 |
| `src/lib/runtime-media-inventory.ts` 与其运维 CLI | 当前递归遍历时拒绝任何 symlink | 现状不兼容；候选路径必须改为 manifest 驱动审计或显式接受受控叶链接 | 正常候选 inventory 与 manifest 一致；目录/越界/非 manifest 链接仍拒绝 |
| `src/lib/textbook-retrieval/loader.ts` | `realpath(indexRoot)`，顺序/随机打开、`stat`、流读取和共享索引缓存 | `resources/textbook-retrieval` 必须是真实目录；索引文件可为受控叶链接，`realpath` 的根不得改变 | `vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的冷/热/并发读取、哈希和检索 smoke |
| `src/lib/runtime-textbook-retrieval-hot-cache.ts` | 对 runtime root 和 cache parent 做 `lstat`，再对索引叶 `createReadStream` | runtime root/cache parent 必须非链接目录；候选叶可读取且与 manifest 精确匹配 | 有/无热缓存、源 size/hash 不符、缓存 receipt identity 不符分别验证 |

本次搜索未发现生产运行态路径的 `fs.watch`、`watchFile`、chokidar 或 inode 比较调用。这个结论仅覆盖上述应用与 runtime-release 目录；每次新增生产运行态消费者都必须补入本矩阵。

## 物化器不变量

1. 输入只能是已完成远端独立验证的一份 v2 manifest 和只读 blob 挂载；不得扫描未受该 manifest 约束的 Bucket 前缀。
2. 创建时使用候选目录内的原子临时目录；目录组件逐层以物理目录建立，禁止目录 symlink。
3. 每个叶文件先从其 SHA-256 推导唯一 blob key，再建立相对或绝对受控链接。物化器以 `lstat`、`realpath` 和 manifest size/hash 验证链接目标；目标必须在固定 blob mount 根中。
4. 本地兼容 manifest 为普通、只读文件，保存 release ID、版本、semantic digest、wire digest 和 logical tree digest。它不是新的发布权威。
5. 验证完整逻辑文件集、每项 size、受控链接目标与代表性内容哈希后，才可在 host lifecycle lock 内以本地文件系统 rename 选中候选目录。
6. Podman 只得到选中目录的单一只读 bind。blob 挂载、临时目录、事务文件和候选目录均不进入容器。
7. 失败、崩溃或身份漂移只能删除未选中的临时目录，不能改变现有 active 目录、v1 selector 或 v1 receipt。

## 执行矩阵

| 层次 | 必需证据 | 失败判定 |
| --- | --- | --- |
| 格式与远端读取 | v2 manifest parser、blob key 推导、Blob 逐项 size/hash、manifest-last receipt | 未知 schema、任意 object key、缺失/篡改 blob、重复或不安全路径 |
| 本地物化 | 临时目录权限、物理目录集合、受控叶链接、完整路径集和本地兼容 manifest | 目录链接、根/manifest 链接、悬挂/越界叶、额外路径、读写权限错误 |
| host verifier | v2-aware `verify_mounted` 完整校验、代表性哈希和 active identity 比对 | 文件集、size、SHA、release/digest、selector generation 任一不一致 |
| 应用路由 | 课程入口、MDX、公开资源、私有媒体 redirect、课程资源 smoke | 路由返回不等价内容、绕过 manifest allowlist、暴露 blob 路径或永久 OSS URL |
| 教材检索 | 三个热索引的冷、热、并发 benchmark 与检索结果 smoke | hash/结果不一致、超过已测性能阈值或热缓存身份漂移 |
| 回滚 | v2 候选失败保持 v1 active；v2 active 到 v2 rollback；显式 v2 到 v1 rollback | 任一失败改变 prior active，或 marker/lifecycle/receipt 无法恢复 |

## 当前结论

v1 host verifier 和 runtime media inventory 均明确拒绝 symlink，因此 symlink forest 还没有资格进入生产选择。任务 4.1 至 4.3 必须先完成受控链接验证、完整 harness 和真实 ECS candidate benchmark；结果通过后才能评估独立的生产切换授权。
