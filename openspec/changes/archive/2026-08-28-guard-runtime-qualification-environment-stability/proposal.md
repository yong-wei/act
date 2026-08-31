## Why

候选消费者 smoke 与证明捕获之间存在应用镜像或数据库迁移切换的时间窗口。若只在 smoke 后读取应用身份，证明可能绑定一个从未实际消费候选 Runtime 的新环境。

## What Changes

- 在候选消费者 smoke 前捕获真实 app/worker 镜像、嵌入 revision 与已应用迁移集。
- 捕获 proof 后比较两份环境身份；任何变化均在 desired 或 active Runtime 写入前失败。

## Impact

- Runtime compatibility proof helper、日常 Runtime activator 和部署契约测试。
- `runtime-main-app-compatibility-proof` 的实际消费者环境不变量。
