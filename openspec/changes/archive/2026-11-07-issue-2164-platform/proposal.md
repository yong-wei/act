# Proposal: issue-2164-platform — 统一身份受控接入（阶段 A）

- Issue: #2164（Platform 协调；platform 侧 #2–#8 已 CLOSED，Keycloak 测试 realm 已隔离验证）
- 类型: 认证接入（多阶段；本 change 覆盖阶段 A：应用侧 OIDC 接入与 person_id 映射）

## Why

platform 身份中心（Keycloak，正式授权地址 `https://auth.adapt-learn.online`、隔离验证 issuer `http://127.0.0.1:18080/realms/platform-test`）与公共契约（person_id 映射、按需登录、角色契约、退出停用、API 语义）已就绪。ACT 须按同标准接入：统一认证后继续使用本地业务主键与历史数据。

## What Changes（阶段 A）

1. **OIDC Provider（env 驱动、默认关闭）**：authOptions 动态附加 Keycloak 型 provider——`PLATFORM_OIDC_ISSUER/CLIENT_ID/CLIENT_SECRET` 未配置时行为与现状完全一致（零风险部署）；配置后 `/login` 出现「统一身份登录」入口。正式 DNS 未切换前生产保持未配置。
2. **person_id→User.id 映射（复用 Account 表，无 schema 迁移）**：signIn 回调按 `Account(provider='platform', providerAccountId=person_id)` 查既有映射；无映射时按 OIDC email/学号声明匹配现有 User 并写 Account 关联（保留全部历史关联：StudentProfile、ClassSession、证据、报告）；不匹配时拒绝登录（不自动建号——教师/学生账号由管理员预建或按学号规则匹配）。
3. **已映射用户旧凭据收紧**：Credentials authorize 检查该用户存在 platform 映射且 `PLATFORM_OIDC_ENFORCED=true` 时拒绝本地密码（已停用/迁移账号不能绕过 IdP）；默认 false（灰度期双通道）。
4. **游客/受保护语义不回归**：不引入全站跳转中间件；游客页面保持匿名（现状）；受保护页面继续 getServerSession 守卫；API 401 保持 JSON（抽查既有形态并断言）。
5. **角色映射**：OIDC 声明 `platform_roles` 含 teacher/admin 时映射 UserRole，但**本地角色以数据库为准**（统一教师身份不自动获得所有课堂访问权）；首登录可提权需 env 开关，默认只降不升。

## Impact

- `src/lib/auth.ts`（动态 provider + 映射 + 收紧）、`/login` 页入口、`.env.example` 新增三变量、单测。
- 无 Prisma 迁移（Account 表复用）。部署在 DNS 切换后配置 env 即启用。

## Non-Goals

- 不做画像/学习结果事件接入（platform#9，独立变更）。
- 不做跨应用验收与分批切换（platform#11，验收属 platform）。
- 不批量重建用户/课堂；不动课堂授权模型。
- 阶段 B（退出联动/缓存隔离细化、应用目录注册）随联调推进。
