# platform-identity-access Delta

## MODIFIED Requirements

### Requirement: 统一身份受控接入

应用 MUST 支持以环境变量受控启用 OIDC 统一身份提供方；未配置或配置不全时认证行为 MUST 与现状完全一致。受保护页面 MUST 在当前 ACT 页面内完成认证，不得把顶层页面导航到身份中心。游客可访问页面 MUST 保持匿名可访问，optional session/profile 的匿名 401 不得打开登录框。

#### Scenario: 未配置零行为变化

- **WHEN** PLATFORM_OIDC_ISSUER 等变量未配置
- **THEN** providers 仅含本地凭据，登录页无统一身份入口

#### Scenario: 页面内主动登录

- **WHEN** 用户在受保护页面主动登录
- **THEN** 当前页面打开安全登录框，成功后恢复原深链和草稿，顶层页面不离开 ACT

#### Scenario: 公开内容匿名访问

- **WHEN** 匿名用户访问公开课程、媒体、演示或公开课堂信息
- **THEN** 内容正常返回且不触发登录事务

### Requirement: person_id 映射保留业务主键

统一身份登录 MUST 先验证 `(issuer, subject)` 和中央 `person_id`，再通过可信映射找到本地 User；`profile.sub` MUST NOT 直接作为 person_id。映射后业务主键、StudentProfile、课堂、证据与报告的历史关联 MUST 原样保留。系统 MUST NOT 按邮箱、姓名或未验证用户名自动并号。中央 admin MUST 仅按显式 person_id 绑定到既有本地 ADMIN，普通账号不得通过 username、token 或自报角色提权。

#### Scenario: 既有映射直登

- **WHEN** 已存在 issuer+subject 到本地 User 的可信映射
- **THEN** 会话为对应本地 User，主键与业务角色不变

#### Scenario: 自动并号被拒绝

- **WHEN** 没有可信映射但 OIDC email 或 username 与现有 User 相同
- **THEN** 登录不得据此合并或创建认证账号

#### Scenario: 中央管理员显式绑定

- **WHEN** 迁移输入显式指定中央 admin 的 person_id 和本地 ADMIN 映射
- **THEN** 仅该绑定生效，其他同名账号不获得 ADMIN

### Requirement: 迁移账号旧凭据收紧

启用收紧开关后，已建立中央映射的用户 MUST NOT 再通过本地密码登录；未启用时本地凭据保留用于灰度。拒绝 MUST NOT 泄露用户存在性。本地认证账号创建、全局启停和密码写入口 MUST 返回退役状态，不得生成平行的第二套凭据。

#### Scenario: 收紧后旧密码拒绝

- **WHEN** ENFORCED=true 且已映射用户提交正确本地密码
- **THEN** 认证失败且原因不可区分

#### Scenario: 本地写凭据入口退役

- **WHEN** 管理端调用本地建号、密码修改或全局启停接口
- **THEN** 返回退役状态且不写入认证凭据；业务角色和班级管理不受影响

### Requirement: 角色以后端数据库为准

统一身份的声明角色 MUST NOT 直接授予应用内角色或课堂访问权；会话角色 MUST 以本地数据库记录为准。中央新授权但缺少本地业务映射或角色时 MUST 明示待配置，不得默认为 ADMIN 或扩大教师班级范围。

#### Scenario: 统一教师不越权

- **WHEN** 声明含 teacher 但本地 User.role=STUDENT
- **THEN** 会话角色仍为 STUDENT

## ADDED Requirements

### Requirement: ACT 准入先于本地授权

受保护会话 MUST 校验当前 ACT grant、中央人员状态和 sessionVersion，再执行本地角色、教学班、课堂和资源归属检查。无 grant 返回 403，中央不可用不得伪装成用户无权限。ACT 撤权不得撤销其他应用资格，全局禁用必须使已接入应用失效。

#### Scenario: 撤权与恢复

- **WHEN** 中央撤销 ACT grant 后恢复
- **THEN** 旧 ACT 会话失效，重新完成 SSO 后才能恢复访问，其他应用会话不受影响

#### Scenario: 中央授权但本地未配置

- **WHEN** 人员具有 ACT grant 但没有可信本地映射或业务角色
- **THEN** 返回待配置状态，不扩大任何资源权限

### Requirement: 登录生命周期不制造业务副作用

页面内事务 MUST 绑定来源、state、nonce、PKCE 和一次性完成结果。取消不得建立会话，完成与取消不得互相覆盖，账号切换必须取消个人请求并清除个人缓存。本应用退出后不得未经主动操作自动重建 SSO；全局退出必须结束中央会话。登录、取消和切换不得自动开始仿真、重复提交、计分或生成学生证据。

#### Scenario: 取消保留草稿

- **WHEN** 用户在编辑或课堂深链中取消登录
- **THEN** 不建立会话，当前草稿和页面状态保留

#### Scenario: 本应用退出后的深链

- **WHEN** 用户退出本应用后再次访问受保护深链
- **THEN** 页面等待主动重新登录，不自动创建 SSO 事务

### Requirement: ACT 名册迁移保留例外与业务归属

应用 MUST 提供受独立令牌保护的分页名册导出，包含本地用户标识、可信学号或工号、账号状态、ACT 准入和业务角色基线，不得导出密码、令牌、秘密或学习证据。迁移 MUST 保留 ACT-only 账号例外，不得因 Achieve 无记录而删除账号或改变本地业务主键。

#### Scenario: ACT-only 账号保留

- **WHEN** 有效 ACT 账号没有 Achieve 来源记录
- **THEN** 迁移将其列为例外保留，不删除账号或改变历史归属

#### Scenario: 名册不含凭据

- **WHEN** 调用名册导出
- **THEN** 响应不包含密码、密码哈希、访问令牌、刷新令牌或秘密字段
