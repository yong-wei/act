## ADDED Requirements

### Requirement: 首次统一登录建立 ACT 档案

经过验证的统一身份持有有效 ACT 准入和服务端建档依据时，ACT MUST 复用可信业务档案，或原子创建无本地口令的档案和身份关联。新档案使用 Achieve 推断角色，名册外为未分班外部学生。认证中心管理员指定的普通角色优先应用，已有本地管理员及教学关系由 ACT 维护。

#### Scenario: 首次或并发登录

- **WHEN** 有效统一身份在 ACT 尚无业务档案或并发首次登录
- **THEN** 只建立一份本地档案和稳定关联，确认平台关联后建立会话

#### Scenario: 名册外首次登录

- **WHEN** ACT 获得该账号的有效准入但 Achieve 名册中没有师生身份
- **THEN** 以未分班外部学生建立无本地口令的档案

#### Scenario: 认证中心修改普通角色

- **WHEN** ACT 收到更新版本的认证中心普通角色覆盖
- **THEN** 在下次统一登录应用普通角色覆盖，无需新建档案，迟到的早期角色设置不得覆盖新版

#### Scenario: 无法建立可信关联

- **WHEN** 建档判定缺失或候选历史映射发生冲突
- **THEN** 提示待配置，保留已有业务档案且不建立会话

## MODIFIED Requirements

### Requirement: person_id 映射保留业务主键

统一身份登录 MUST 先验证 `(issuer, subject)` 和中央 `person_id`，再复用可信映射，或根据首次建档规则建立绑定。`profile.sub` MUST NOT 直接作为 person_id。映射后业务主键、StudentProfile、课堂、证据与报告的历史关联 MUST 原样保留。系统 MUST NOT 按邮箱、姓名或未验证用户名自动并号。中央 admin MUST 仅按显式 person_id 绑定到既有本地 ADMIN。

#### Scenario: 既有映射直登

- **WHEN** 已存在 issuer+subject 到本地 User 的可信映射
- **THEN** 会话为对应本地 User，业务主键保持，普通角色仅在有认证中心显式覆盖时更新

#### Scenario: 自动并号被拒绝

- **WHEN** 没有可信映射但 OIDC email 或 username 与现有 User 相同
- **THEN** 系统不依据 email 或 username 关联上述档案

#### Scenario: 中央管理员显式绑定

- **WHEN** 迁移输入显式指定中央 admin 的 person_id 和本地 ADMIN 映射
- **THEN** 仅该绑定生效，其他同名账号不获得 ADMIN

### Requirement: 角色以后端数据库为准

会话角色 MUST 以 ACT 本地数据库记录为准。ACT 对首次档案使用服务端推断角色，已有普通账号仅应用认证中心管理员的显式覆盖。统一身份的声明角色 MUST NOT 直接授予应用内角色或课堂访问权。

#### Scenario: 统一教师不越权

- **WHEN** 声明含 teacher，本地 User.role=STUDENT，且无显式覆盖
- **THEN** 会话角色仍为 STUDENT

### Requirement: ACT 准入先于本地授权

受保护会话 MUST 校验当前 ACT grant、中央人员状态和 sessionVersion，再执行本地角色、教学班、课堂和资源归属检查。无 grant 返回 403，中央不可用不得伪装成用户无权限。ACT 撤权不得撤销其他应用资格，全局禁用必须使已接入应用失效。

#### Scenario: 撤权与恢复

- **WHEN** 中央撤销 ACT grant 后恢复
- **THEN** 旧 ACT 会话失效，重新完成 SSO 后才能恢复访问，其他应用会话不受影响

#### Scenario: 中央授权但本地未配置

- **WHEN** 人员具有 ACT grant，且可信映射和首次建档均不可用
- **THEN** 返回待配置状态并保留既有业务权限边界
