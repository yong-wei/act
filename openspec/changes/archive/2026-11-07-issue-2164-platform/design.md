# Design: issue-2164-platform

## 配置

- `PLATFORM_OIDC_ISSUER`（如 https://auth.adapt-learn.online/realms/platform）
- `PLATFORM_OIDC_CLIENT_ID` / `PLATFORM_OIDC_CLIENT_SECRET`
- `PLATFORM_OIDC_ENFORCED`（默认 false：已映射用户仍可用本地密码；true=收紧）

三者齐备才附加 provider；读取在模块加载时一次（authOptions 构造）。

## 映射（复用 NextAuth Account 表）

- signIn 回调：`profile.sub` = person_id。查 `account(provider='platform', providerAccountId=sub)` → 得 userId。
- 无映射：`profile.email` 或 `profile.preferred_username`（学号/工号）匹配 `user.email` / `employeeNumber` / `studentProfile.studentNumber` → 命中则 `account.create()` 关联；未命中返回 false（拒绝，不自动建号）。
- 映射后 token.id = 本地 User.id（业务主键不变，历史关联全保留）。

## 收紧

Credentials.authorize 尾部：若 `PLATFORM_OIDC_ENFORCED==='true'` 且 `account.count({userId, provider:'platform'})>0` → null。

## 角色安全

session 回调保持 DB role 为准；OIDC 声明仅日志记录，不写库（阶段 B 再议提权流程）。
