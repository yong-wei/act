# 开发只读 RAM 用户创建与撤销

这份文档给维护者。真实 AccessKey ID / Secret 只允许出现在阿里云控制台和密码管理器里，不得写入仓库、Issue、PR、`.env`、日志或本文件。

## 创建

1. 在 RAM 控制台创建自定义策略，内容必须与仓库模板逐字一致：
   `scripts/runtime-release/developer-oss/act-runtime-dev-read.policy.json`
2. 本地校验模板：

   ```bash
   npm run runtime:dev-validate-policy
   ```

3. 创建 RAM 用户 `act-runtime-dev-read`，只附加上述策略。不要附加 AliyunOSSFullAccess、Publisher 或 ECS 角色。
4. 为该用户创建**一把** AccessKey，立即保存到密码管理器条目 `ACT / act-runtime-dev-read`。控制台页面关闭后 Secret 不可再看。
5. 用 ossutil 做一次受控验证（在受控 Linux 上，不要把命令历史贴进仓库）：
   - 允许：读取 `runtime/blob-releases/<active-id>/manifest.json` 与对应 blob
   - 拒绝：Put / Delete / 覆盖任意对象
6. 通过密码管理器或端到端加密渠道把同一把密钥发给当前合作者名单。记录名单，不要记录 Secret。

## 边界

- 策略不能表达“当前 active Release”；active 选择由生产 readiness 与本地启动事务约束。
- 该用户技术上能读取策略覆盖的历史/候选 v2 对象。服务层仍只挂载 readiness 给出的 active Release。
- 公网 Endpoint 是 `https://oss-cn-hangzhou.aliyuncs.com`。杭州内网 Endpoint 只给 ECS。
- 不要复用 `act-runtime-publisher-local` 或 ECS `act-runtime-oss-read` 给合作者。

## 撤销

顺序必须是：

1. 删除 AccessKey（立即切断挂载）
2. 确认新的 `startup:oss-runtime` 因身份/权限失败
3. 删除 RAM 用户或策略绑定
4. 通知合作者删除本机 `~/.config/act-runtime-dev-read/credentials.json` 并卸载 mount

成员退出或怀疑泄露时，先换钥（删旧 AccessKey、建新钥匙并只发给仍在名单中的人），再清理离队者本机状态。
