## Why

控制工作台、课程仿真和其他受支持入口已经将可验证运行写入标准 `SimulationRun`，但普通个人中心的统计、最近活动和仿真档案仍主要读取旧 `SimulationLog`。学生完成训练后看不到同一条学习证据，个人中心与学习陪伴使用的证据集合因此不一致。

## What Changes

- 让普通个人中心的仿真次数、总时长、平均得分和最近活动消费标准 `SimulationRun` 摘要。
- 让个人档案的仿真设计记录消费标准运行的学生安全摘要，而不是仅消费旧日志。
- 保留旧 `SimulationLog` 的兼容读取，并按稳定来源身份去重，避免迁移期重复计数。
- 保持当前学生身份隔离、可验证运行筛选和预览/官方结果边界。
- 明确标准运行缺少展示所需证据时应显示为空或不可用，不得用不完整记录制造学生事实。

## Capabilities

### New Capabilities

- `student-profile-simulation-evidence`: 定义普通个人中心和个人档案消费标准仿真运行的统计、最近活动、摘要和兼容去重边界。

### Modified Capabilities

- `simulation-scene-trace-protocol`: 补充个人中心等 profile consumer 对 canonical `SimulationRun` 摘要的消费要求，并约束旧日志兼容不得替代或重复 canonical run 身份。

## Impact

- 影响 `/profile` 统计与最近活动、`/profile/portfolio` 仿真档案及其服务端投影接口。
- 影响 `SimulationRun` 与 `SimulationLog` 的兼容读取、来源归属、去重和学生隔离测试。
- 不改变官方提交、排行榜、正式成绩或能力达成的权威来源；不新增物理模型或前端数值计算。
