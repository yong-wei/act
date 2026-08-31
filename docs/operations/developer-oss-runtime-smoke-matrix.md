# 开发 Runtime 网关三平台 smoke 矩阵

真实网关令牌由维护者在实现审查通过、ECS 网关受控部署之后创建。代理不得在仓库、Issue、PR 或日志中写入令牌、AccessKey 或 SSH 私钥。下表记录执行位置与当前结果。

| 环境 | FUSE `/dev/fuse` | 数据面 | `startup:oss-runtime` | 重启跟到新 active | `shutdown:oss-runtime` | 课程/媒体/教材可读 | runtime 写入拒绝 | 共享二次读取无额外体传输 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 仓库假工具契约 | 夹具 | ECS 网关契约 | 复用匹配状态 / 失败关闭 | 下次启动解析新 identity；存活租约可续期传输凭证 | 只停本 checkout 的 bind/lease；末个 lease 才卸共享适配器 | 物化视图文件可读；无 RAM role 时媒体走本地 `/course-runtime` | 由只读 bind 合同覆盖 | `prove-read` / `operations.jsonl` 证明同一 SHA 第二次为 cache-hit | 已用 `npm run test:developer-oss-runtime` 覆盖契约 |
| 原生 Linux | 待合作者本机 FUSE | ECS 网关 HTTPS 已冒烟 | 待合作者 `startup:oss-runtime` | 待 | 待 | 待 | 待 | 待真实网关二次读取缓存 | 2026-08-31：`https://runtime-dev.adapt-learn.online` 已签发证书并反代 `127.0.0.1:8787`。公网 HTTPS 签发/manifest/receipt/允许集 GET/Range/额外 digest 拒绝/无令牌拒绝已通过。学生站媒体仍 307 到杭州 OSS 签名 URL。三平台本机 FUSE 启动仍待合作者安装凭据后冒烟。 |
| Windows WSL2 | 待合作者本机 FUSE | 公网 HTTPS 已通 | 待 | 待 | 待 | 待 | 待 | 待 | 阻塞：合作者按文档安装网关凭据并跑 `startup:oss-runtime` |
| macOS Lima/Colima | 待合作者本机 FUSE | 公网 HTTPS 已通 | 待 | 待 | 待 | 待 | 待 | 待 | 阻塞：同上 |

实现期不得把本机 Publisher 钥匙串、`act-runtime-dev-read` AccessKey 或 `ACT_RUNTIME_OSS_RAM_ROLE` 当作开发数据面做冒烟。ECS 网关公网 HTTPS 冒烟已完成。删除旧 RAM AccessKey 是合作者改走网关之后的维护者后续动作。
