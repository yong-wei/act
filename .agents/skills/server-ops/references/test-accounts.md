# 测试账号核对与修复

三角色验证账号真源是 `scripts/db/verified-test-accounts.mjs`。本地开发与生产都写入同一组登录名和密码。

登录字段使用“学号/工号”，不是邮箱：

| 角色 | 登录名 | 密码 | 邮箱 |
| --- | --- | --- | --- |
| 学生 | `demo` | `DemoStudent@Just2026!` | `demo@example.com` |
| 教师 | `test_teacher` | `TestTeacher@Just2026!` | `test_teacher@example.com` |
| 管理员 | `admin` | `admin@Just` | `admin` |

本地写入（直接跑脚本。`npm run seed:*` 走 apply 门禁，默认不执行写库）：

```bash
node scripts/db/ensure-verified-test-accounts.mjs
# 或 node scripts/db/seed-demo-user.mjs
#    node scripts/db/seed-admin.mjs
#    node scripts/db/update-fixed-account-passwords.mjs
```

生产写入并做 HTTP 登录验收：

```bash
bash scripts/db/ensure-production-test-accounts.sh
```

只验收登录：

```bash
node scripts/db/verify-test-account-login.mjs --base-url https://act.adapt-learn.online
```

核对生产身份：

```bash
ssh root@121.40.124.135 "podman exec act-obe-postgres psql -U act_user -d act_obe -c \"SELECT u.email, u.role, u.\\\"employeeNumber\\\", p.\\\"studentNumber\\\" FROM \\\"User\\\" u LEFT JOIN \\\"StudentProfile\\\" p ON p.\\\"userId\\\" = u.id WHERE u.email IN ('demo@example.com', 'test_teacher@example.com', 'admin');\""
```

`test_teacher` 工号必须唯一。若另有同名工号行，生产脚本会清空冲突工号，只保留 `test_teacher@example.com`。
