# 开发网关令牌的维护与撤销

这份文档给维护者。真实网关令牌、AccessKey、SSH 私钥只允许出现在密码管理器和受控主机文件里，不得写入仓库、Issue、PR、`.env`、日志或本文件。

合作者默认数据面是 ECS 激活 runtime 只读网关，不是 RAM 用户 `act-runtime-dev-read`。不要向合作者分发 SSH、OSS AccessKey、Publisher 或 ECS 内网 Endpoint。

## 签发（仅在受控冒烟之后）

1. 在 ECS 上生成一把足够长的随机令牌，写入 `/etc/act-runtime-developer-gateway/token`（目录 `0700`、文件 `0600`）。
2. 令牌不得呈 AccessKey / `LTAI` 形状。
3. 用同一把令牌完成一次受控 smoke：lease 签发、允许集内 Blob GET、允许集外拒绝、学生媒体签名仍不依赖该令牌。
4. 通过密码管理器条目（建议：`ACT / developer-runtime-gateway`）把网关 URL 与令牌发给当前合作者名单。记录名单，不要记录令牌值。
5. 合作者只安装网关凭据并运行 `npm run startup:oss-runtime`。

## 撤销（必须先轮换网关令牌）

顺序必须是：

1. 在 ECS 上轮换 `/etc/act-runtime-developer-gateway/token`，使旧令牌恒定时间比较失败。
2. 确认新的 `startup:oss-runtime` 被拒绝；已停止的 checkout 不能续期传输凭证。
3. 通知合作者删除本机 `~/.config/act-runtime-dev-gateway/credentials.json` 以及 checkout 下的 `gateway-session.json`，并卸载仍在的 runtime bind。
4. 不要为了撤销而分发 SSH 或 OSS AccessKey。

成员退出或怀疑泄露时，先轮换网关令牌，再清理离队者本机状态。

## 旧 RAM 用户的后续动作

删除 `act-runtime-dev-read` AccessKey **不是**切换默认数据面的前置步骤。它是新默认 smoke 通过之后的维护者后续动作：

1. 确认合作者已改用网关令牌，且新启动不再访问公网 Hangzhou Endpoint。
2. 在 RAM 控制台删除 `act-runtime-dev-read` 的 AccessKey（必要时再删用户或策略绑定）。
3. 通知仍持有旧 `~/.config/act-runtime-dev-read/credentials.json` 的人删除该文件。

在此之前，默认启动已经拒绝 AccessKey、ossfs2 公网 Endpoint 和 `ACT_RUNTIME_OSS_RAM_ROLE`。旧钥匙残留不能作为开发数据面。
