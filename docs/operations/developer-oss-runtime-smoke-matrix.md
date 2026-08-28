# 开发 OSS Runtime 三平台 smoke 矩阵

真实凭据由用户在实现审查通过后创建。代理不得在仓库、Issue、PR 或日志中写入 Secret。下表记录执行位置与当前结果。

| 环境 | FUSE `/dev/fuse` | 公网 OSS | `startup:oss-runtime` | 重启跟到新 active | `shutdown:oss-runtime` | 课程/媒体/教材可读 | runtime 写入拒绝 | 共享二次读取无额外体传输 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 仓库假工具契约 | 夹具 | 夹具 | 复用匹配状态 / 失败关闭 | 下次启动解析新 identity | 只停本 checkout 的 bind/lease；末个 lease 才卸共享 FUSE | 物化视图文件可读 | 由只读 bind 合同覆盖 | `prove-read` / `operations.jsonl` 证明同一 SHA 第二次为 cache-hit | 已用 `npm run test:developer-oss-runtime` 覆盖契约 |
| 原生 Linux | 待用户受控密钥 smoke | 待 | 待 | 待 | 待 | 待 | 待 | 待真实 ossfs2 2.0.8+ 日志 | 阻塞：真实 AccessKey 冒烟未跑 |
| Windows WSL2 | 待用户受控密钥 smoke | 待 | 待 | 待 | 待 | 待 | 待 | 待 | 阻塞：同上 |
| macOS Lima/Colima | 待用户受控密钥 smoke | 待 | 待 | 待 | 待 | 待 | 待 | 待 | 阻塞：同上 |

实现期不得把本机 Publisher 钥匙串当作开发只读身份做冒烟。6.4 / 6.5 在审查通过、用户保存真实凭据后再填真实三行。
