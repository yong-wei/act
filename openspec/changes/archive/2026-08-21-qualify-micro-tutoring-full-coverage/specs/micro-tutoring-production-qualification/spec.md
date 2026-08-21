## ADDED Requirements

### Requirement: 生产资格绑定全题静态与真实服务端证据

系统 SHALL 仅在当前 v1 基线的 54 道题、108 个错误选项全部通过严格覆盖，并且归因、节点、资源、验证、授权、漂移、幂等和持久化测试均通过时生成微辅导生产资格候选。测试 MUST 覆盖真实服务端边界和 production-like PostgreSQL，不得以浏览器夹具替代。

#### Scenario: 全题链路满足资格

- **WHEN** 同一捕获修订的严格报告显示 54/54 题和 108/108 错误选项完整，所有必需服务端测试通过
- **THEN** 系统 MAY 生成生产资格候选
- **AND** 候选 SHALL 列出实际执行的测试、范围和结果

#### Scenario: 任一内容或服务端缺口存在

- **WHEN** 严格报告、授权、漂移、持久化或幂等测试任一失败
- **THEN** 资格 SHALL 失败关闭
- **AND** 不得以已知豁免把内容缺口标为通过

### Requirement: 浏览器验收覆盖代表性完整与恢复流程

Playwright 验收 SHALL 使用真实学生 UI 和服务端 API 覆盖验证成功、验证失败、不可用、`REFERENCE_DRIFT`、重新编排及进入常规练习，并覆盖四类代表性知识域、light/dark、1440px/320px 和控制台错误检查。截图仅作为代表性证据，程序化审计负责全量覆盖。

#### Scenario: 代表性成功和失败流程通过

- **WHEN** 学生从错误作答完成资源动作并提交独立验证
- **THEN** 浏览器证据 SHALL 分别证明成功与失败后的受治理建议
- **AND** 页面不得泄露答案、教师信息或内部身份

#### Scenario: 引用漂移发生

- **WHEN** 测试在干预开始后使受控资源或验证题 identity 漂移
- **THEN** UI SHALL 显示安全不可用和恢复动作
- **AND** 服务端不得记录伪造完成结果

### Requirement: 资格回执绑定不可变发布身份

生产资格回执 MUST 绑定 source/full commit、应用 OCI image digest、目录/审核/baseline/归因/节点/资源/验证工件摘要、数据库 capture revision、严格审计摘要和浏览器证据 manifest/hash。任一输入来自不同修订、工作树不洁净或摘要无法回读时，回执不得生成。

#### Scenario: 发布输入一致

- **WHEN** 所有资格输入可由同一提交和数据库投影回读且摘要一致
- **THEN** 系统 SHALL 生成不可变 candidate receipt
- **AND** receipt identity SHALL 由规范化完整包络内容决定

#### Scenario: 混合修订证据

- **WHEN** 应用、治理工件、数据库投影或浏览器证据任一不属于同一候选身份
- **THEN** 系统 SHALL 报告发布漂移
- **AND** 不得选择较新的部分证据拼接通过

### Requirement: 资格、生产激活和回滚保持独立授权

资格通过 SHALL 只产生 candidate，不得自动修改生产 selector 或功能开关。生产激活 MUST 经显式授权，以 canary、监测和可回读 active receipt 执行；回滚 SHALL 关闭新入口并保留 append-only 干预数据和资格证据。

#### Scenario: 候选资格通过但未获激活授权

- **WHEN** candidate receipt 有效而生产激活尚未授权
- **THEN** 生产行为 SHALL 保持不变
- **AND** 候选不得被描述为已上线

#### Scenario: canary 指标越界

- **WHEN** canary 期间不可用率、错误率或关键漏斗指标超过受控阈值
- **THEN** 系统 SHALL 执行或请求受控回滚
- **AND** 已产生的数据和 receipt SHALL 保持可审计
