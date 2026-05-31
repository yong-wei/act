# 测试账号核对与修复

常用账号：

- 学生：`demo` / `DemoStudent@Just2026!`
- 教师：`test_teacher` / `TestTeacher@Just2026!`

登录字段：

- 使用“学号/工号”字段，不是邮箱

校验账号是否存在：
```bash
ssh root@121.40.124.135 "podman exec act-obe-postgres psql -U act_user -d act_obe -c \"SELECT email, role, \\\"passwordHash\\\" IS NOT NULL as has_password FROM \\\"User\\\" WHERE email IN ('demo@example.com', 'test_teacher@example.com');\""
```

如需生成新密码哈希：
```bash
ssh root@121.40.124.135 "podman exec -i act-obe-app node -e '
const bcrypt=require(\"bcryptjs\");
console.log(bcrypt.hashSync(\"DemoStudent@Just2026!\", 10));
'"
```

如需重建测试账号，可参考 `.claude/skills/server-ops/README.md` 中的 SQL 模板。
