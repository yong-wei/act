# Tasks: issue-2164-platform（阶段 A）

- [x] A1 OIDC provider 动态接入（env 三变量，未配置零行为变化；Keycloak 型 issuer/authorization/token/userinfo）
- [x] A2 person_id 映射：Account(provider='platform') 查既有；无则按 email/学号声明匹配 User 并写关联；不匹配拒绝
- [x] A3 已映射用户旧凭据收紧（PLATFORM_OIDC_ENFORCED，默认 false；拒绝时 null 不泄露原因）
- [x] A4 /login 统一身份入口按钮（provider 配置才显示；游客页无跳转）
- [x] A5 .env.example 三变量 + 文档说明（正式 issuer/测试 realm/默认关闭语义）
- [x] A6 单测：provider 开关、映射三分支（既有/新建关联/拒绝）、收紧开关、JWT/session 回调保持
- [x] A7 typecheck + test:unit 定向 + strict validate
