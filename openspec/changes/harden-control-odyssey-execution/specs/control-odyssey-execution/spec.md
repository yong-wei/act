## Purpose

定义控制奥德赛从固定步长运行到成绩、账户和排行榜的完整性要求，使手动与自动训练保留原有玩法，同时让奖励建立在可复核运行之上，并保证不同帧率与执行端的结果一致。

## ADDED Requirements

### Requirement: New Odyssey rewards require server-verified completion
系统 SHALL 依据有界的运行输入记录在服务端复核新运行，并使用复核指标计算既有评分公式；客户端分数、指标或完成标记 MUST NOT 单独触发积分、关卡进度或学习完成证据。

#### Scenario: Forged or incomplete result
- **WHEN** 登录用户提交虚构分数、缺失运行记录、非法参数或未完成的运行
- **THEN** 系统 MUST 拒绝未验证的奖励与进度更新，并返回可理解的失败结果。

#### Scenario: Manual and adjusted automatic runs
- **WHEN** 用户完成含手动输入或运行中参数调整的合法运行
- **THEN** 服务端 MUST 能重放实际输入并计算游戏成绩，而非用最后一组参数代替整次运行。

#### Scenario: Duplicate verified run
- **WHEN** 同一用户重试已验证的同一运行
- **THEN** 系统 MUST 使用最初持久化的验证记录，并至多发放一次奖励。

#### Scenario: Legacy record
- **WHEN** 读取已有历史成绩或重试缺少新运行验证材料的旧记录
- **THEN** 历史成绩 MUST 保持可读，且系统 MUST NOT 基于未经验证的旧载荷补发新奖励。

#### Scenario: Persisted legacy automatic Arena recovery
- **WHEN** 已经持久化的旧 GAME 记录具有完整 v1 配置快照、合法关卡与 Arena task 配对及 AUTO 官方资格，但缺少输入轨迹且 Arena 提交尚未落库
- **THEN** 系统 SHALL 仅使用原持久化快照按既有服务端配置重放恢复 Arena 提交，保持恢复幂等；系统 MUST NOT 补发普通积分、推进普通关卡进度或新增普通完成证据，且 MUST 保留此前已经发出的奖励。

#### Scenario: Legacy recovery cannot be forged by a retry
- **WHEN** 用户提交新运行、普通旧缺轨迹运行、旧 MANUAL 官方运行，或试图在重试中替换旧快照、关卡、task、发布范围或轨迹
- **THEN** 系统 MUST NOT 将请求载荷作为旧 AUTO 官方恢复依据；不符合旧官方恢复条件的无轨迹运行 SHALL 保持拒绝新增副作用。

### Requirement: Odyssey account mutations preserve concurrent updates
系统 SHALL 原子核验并修改积分、控制器拥有状态、等级和关卡进度；不同运行与账户操作 MUST NOT 使用旧快照覆盖其他成功操作。

#### Scenario: Concurrent purchases or upgrades
- **WHEN** 同一账户并发购买、升级或兑换 AI 积分
- **THEN** 成功扣款总额 MUST 不超过可用余额，且每次实际扣款对应的升级或解锁 MUST 保留。

#### Scenario: Completion races with upgrade
- **WHEN** 通关奖励与控制器升级并发发生
- **THEN** 奖励 MUST 不回退控制器等级或丢失其他关卡进度。

### Requirement: Terminal simulation state is final within a frame
系统 SHALL 在首次碰撞或通关时停止当前帧剩余仿真步，并固定该终局的指标与输入记录。

#### Scenario: Multiple accumulated steps
- **WHEN** 单帧积累多个固定步长且其中一步到达终局
- **THEN** 后续子步 MUST 不再推进距离、改变终局或追加运行输入。

### Requirement: Discrete delay matches the configured sample count
纯延迟模型 SHALL 按配置延迟对应的离散采样数推迟输入，不额外引入一个采样周期。

#### Scenario: Two-sample delay
- **WHEN** 固定步长为 dt 且配置纯延迟为 2dt
- **THEN** 相同输入的响应 MUST 相对零延迟响应推迟两个采样点。

### Requirement: Browser and server agree on run outcomes
相同合法输入、关卡、配置与步长 SHALL 在浏览器与服务端产生一致的终局和指标；现有无延迟 P 五级、Kp=1.6 的调节时间 MUST 保持为 2.8 秒。

#### Scenario: Finish and collision coincide
- **WHEN** 某步同时到达终点并触及走廊边界
- **THEN** 两端 MUST 使用相同判定顺序并给出相同终局。

#### Scenario: Rendering cadence changes
- **WHEN** 相同输入以不同画面刷新节奏执行
- **THEN** 固定步长遥测与最终指标 MUST 不依赖 React 渲染次数。

### Requirement: Odyssey queries rank each learner's best result
排行榜 SHALL 按关卡先得到每名学习者的最佳有效游戏成绩，再排序返回最多五十名；个人最佳成绩 SHALL 保持各关卡和等级的既有显示语义。

#### Scenario: Many attempts by one learner
- **WHEN** 某学习者拥有超过两百次高分记录且其他学习者也有成绩
- **THEN** 重复尝试 MUST 不挤占其他学习者的排行榜名额。

### Requirement: Existing Arena separation remains intact
系统 SHALL 保持 Arena 官方评分与普通游戏评分分离、指派运行不推进普通进度以及提交恢复幂等；本次优化 MUST NOT 将原本不符合 Arena 官方规则的运行自动变成有效官方提交。

#### Scenario: Assigned run
- **WHEN** 用户完成有效 Arena 指派运行
- **THEN** 系统 MUST 保留既有官方评估与恢复路径，并不发放普通奥德赛进度奖励。
