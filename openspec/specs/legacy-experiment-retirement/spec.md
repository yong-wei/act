# legacy-experiment-retirement Specification

## Purpose
TBD - created by archiving change retire-legacy-deep-sea-control-course. Update Purpose after archive.
## Requirements
### Requirement: 旧综合实验入口退役

`/ilab/deep-sea-control` 原实验 URL MUST 保留唯一薄入口，向访问者声明旧 24 步综合实验已退役并链接七船独立实验目录；系统 MUST NOT 在该入口创建会话、交换外部 ticket 或将 ticket 转发给任何单船实验。

#### Scenario: 访问旧实验入口

- **WHEN** 用户访问 `/ilab/deep-sea-control`
- **THEN** 页面呈现退役说明与七船实验目录链接
- **AND** 不初始化仿真运行、不读取旧浏览器暂存、不发起 ticket 交换

#### Scenario: 访问旧资料子页

- **WHEN** 用户访问旧 task/guide/teaching-guide/rubric/pretest/paper URL
- **THEN** 返回 410 退役说明（存在明确七船对应资料时附链接）
- **AND** 不呈现旧 24 步内容为现行课程

### Requirement: 旧会话写接口恒定 410

旧 `/api/ilab/session` 创建、步骤提交与 complete 接口 MUST 返回 HTTP 410 与稳定错误码 `LEGACY_EXPERIMENT_RETIRED`，且 MUST NOT 产生任何副作用。

#### Scenario: 旧创建请求

- **WHEN** 客户端 `POST /api/ilab/session`
- **THEN** 返回 410，错误码 `LEGACY_EXPERIMENT_RETIRED`
- **AND** 不创建新的 `dsc_` 前缀运行记录、不消耗外部 ticket、不写数据库

#### Scenario: 旧提交与完成请求

- **WHEN** 客户端向 `/api/ilab/session/[originId]/steps` 或 `/complete` 提交
- **THEN** 返回 410 与同一错误码，不执行旧评分器或报告生成

### Requirement: 旧记录鉴权只读

系统 MUST 保留旧运行记录与报告的鉴权只读能力，访问权限不弱于既有课程账号与票据归属要求；且 MUST NOT 将得知 originId 视为授权。

#### Scenario: 归属用户读取旧报告

- **WHEN** 满足既有归属校验的用户请求 `GET /api/ilab/session/[originId]`
- **THEN** 返回该运行的既有报告与步骤数据
- **AND** 响应不加载旧评分器逻辑

#### Scenario: 非归属访问被拒

- **WHEN** 未通过归属校验的请求读取旧运行
- **THEN** 拒绝访问，与现状权限语义一致

### Requirement: 七船实验不受退役影响

退役 MUST NOT 改变七船独立实验的路由、会话、评分、报告与共享基础设施。

#### Scenario: 七船全链路

- **WHEN** 用户在任一 `/simulations/{destroyer,lng,container,cruise,drilling,icebreaker,dredger}` 启动、运行、提交并生成报告
- **THEN** 全流程可用，不依赖旧 24 步数组、评分器或会话服务中的已删部分

#### Scenario: 共享能力保留

- **WHEN** 七船会话使用外部票据协议、AI 调用账本、手绘识别、共享事务锁与错误类型
- **THEN** 这些能力 MUST 继续可用（必要时以中性共享模块承载），行为与退役前一致

### Requirement: 历史数据不被清理

退役属于软件行为变更，MUST NOT 删除或改写真实学生运行记录、报告、成绩与时间戳。

#### Scenario: 记录清单只读

- **WHEN** 执行 `dsc_` 前缀历史清单核查
- **THEN** 仅输出数量/状态/时间范围统计，不执行写操作，无记录时据实输出 0

#### Scenario: 共享表完整

- **WHEN** 退役前后核对 `IlabExperimentRun` 与 `VirtualSimulationReport` 行数
- **THEN** 总行数一致

