# platform-identity-access Specification

## Purpose
TBD - created by archiving change issue-2164-platform. Update Purpose after archive.
## Requirements
### Requirement: 统一身份受控接入

应用 MUST 支持以环境变量受控启用 OIDC 统一身份提供方（issuer/client id/secret 三者齐备才生效）；未配置或配置不全时认证行为 MUST 与现状完全一致；游客可访问页面 MUST 保持匿名可访问（不因 IdP 主会话存在而跳转登录）。

#### Scenario: 未配置零行为变化

- **WHEN** PLATFORM_OIDC_ISSUER 等变量未配置
- **THEN** providers 仅含本地凭据，登录页无统一身份入口

#### Scenario: 配置后受控入口

- **WHEN** 三变量齐备
- **THEN** 登录页出现统一身份登录入口，主动点击才发起 OIDC

### Requirement: person_id 映射保留业务主键

统一身份登录 MUST 将平台 person_id 映射到既有本地 User（复用 Account 表 provider='platform' 记录）；首次登录按 email 或学号/工号声明匹配并建立关联；匹配不到时 MUST 拒绝登录且 MUST NOT 自动创建新用户；映射后业务主键、StudentProfile、课堂、证据与报告的历史关联 MUST 原样保留。

#### Scenario: 既有映射直登

- **WHEN** 已存在 Account(platform, person_id) 记录的用户经统一身份登录
- **THEN** 会话为对应本地 User，主键不变

#### Scenario: 声明匹配建关联

- **WHEN** 无映射但 OIDC email 命中现有 User
- **THEN** 创建 Account 关联并以该 User 身份建立会话

#### Scenario: 未知身份拒绝

- **WHEN** 无映射且声明匹配不到任何现有 User
- **THEN** 登录被拒绝，不自动建号

### Requirement: 迁移账号旧凭据收紧

启用收紧开关（PLATFORM_OIDC_ENFORCED=true）后，已建立 platform 映射的用户 MUST NOT 再通过本地密码登录；未启用时本地凭据保留（灰度双通道）；拒绝 MUST NOT 泄露用户存在性。

#### Scenario: 收紧后旧密码拒绝

- **WHEN** ENFORCED=true 且已映射用户提交正确本地密码
- **THEN** 认证失败（与密码错误不可区分）

### Requirement: 角色以后端数据库为准

统一身份的声明角色 MUST NOT 直接授予应用内角色或课堂访问权；会话角色 MUST 以本地数据库记录为准。

#### Scenario: 统一教师不越权

- **WHEN** 声明含 teacher 但本地 User.role=STUDENT
- **THEN** 会话角色仍为 STUDENT

