# AI-OBE Platform Server Operations Skill

服务器运行状态调查与故障排查技能，适用于基于 Podman/Docker 容器化部署的 Next.js + PostgreSQL 架构。

## 项目信息

- **部署地址**: https://act.adapt-learn.online
- **服务器**: 121.40.124.135 (通过 SSH 访问)
- **容器名称**: `act-obe-app` (应用), `act-obe-postgres` (数据库)

## 测试账号

用于快速验证和功能测试：

| 角色 | 账号 | 密码 | 登录字段 |
|------|------|------|----------|
| **学生** | `demo` | `DemoStudent@Just2026!` | 学号/工号: `demo` |
| **教师** | `test_teacher` | `TestTeacher@Just2026!` | 学号/工号: `test_teacher` |

**注意**：登录时使用"学号/工号"字段输入，不是邮箱地址。

### 验证登录

```bash
# 方法1: 直接访问登录页面手动测试
open https://act.adapt-learn.online/login

# 方法2: 数据库验证账号存在性和密码哈希
ssh root@121.40.124.135 "podman exec act-obe-postgres psql -U act_user -d act_obe -c \"SELECT email, role, \\\"passwordHash\\\" IS NOT NULL as has_password FROM \\\"User\\\" WHERE email IN ('demo@example.com', 'test_teacher@example.com');\""

# 方法3: 重置测试账号密码（如需要）
# 在服务器上执行 Node.js 脚本更新密码
ssh root@121.40.124.135 "podman exec -i act-obe-app node -e '
const bcrypt=require(\"bcryptjs\");
const hash = bcrypt.hashSync(\"DemoStudent@Just2026!\", 10);
console.log(\"UPDATE \\\"User\\\" SET \\\"passwordHash\\\" = '\" + hash + \"' WHERE email = 'demo@example.com';\");
'"
```

### 账号创建/修复

如果测试账号不存在或密码不正确，在服务器上执行：

```bash
# SSH到服务器
ssh root@121.40.124.135

# 创建/更新测试账号 SQL
cat > /tmp/fix_test_accounts.sql << 'EOF'
-- 删除可能冲突的旧记录（保留ID避免外键问题）
DELETE FROM "User" WHERE email IN ('demo@example.com', 'test_teacher@example.com');

-- 插入测试账号（密码：DemoStudent@Just2026! / TestTeacher@Just2026!）
INSERT INTO "User" (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
VALUES
  ('cm8demo000000000000001', 'demo', 'demo@example.com', '$2a$10$eeo0wqOMsuVv9eUqxDHa1ORgcNt1raS/417OCidfpIvh.6yxmp.Ry', 'STUDENT', NOW(), NOW()),
  ('cm8teacher000000000001', 'test_teacher', 'test_teacher@example.com', '$2a$10$1HC5irOuZLrpq4q0oH9cOO5ZCnS6BKxSrkNi9k4uKBFfvm29/W6ta', 'TEACHER', NOW(), NOW());
EOF

# 执行SQL
podman exec -i act-obe-postgres psql -U act_user -d act_obe < /tmp/fix_test_accounts.sql

# 验证
podman exec act-obe-postgres psql -U act_user -d act_obe -c "SELECT email, role FROM \"User\" WHERE email LIKE '%example.com';"
```

## Trigger Conditions

使用此技能当用户提及：
- "服务器有问题"
- "服务不稳定"
- "查看服务器日志"
- "排查线上故障"
- "连接池错误"
- "数据库超时"
- "网站无法访问"
- "课堂同步失败"
- "页面回跳"

## Investigation Workflow

### Phase 1: 日志定位

#### 1.1 本地开发环境日志
```bash
# 前端日志
npm run logs              # .logs/frontend.log
npm run logs:error        # .logs/error.log

# 或直接查看
tail -f .logs/frontend.log
tail -f .logs/error.log
```

#### 1.2 远端服务器日志（Podman部署）
```bash
# SSH连接到服务器
ssh root@121.40.124.135

# 实时查看容器日志
podman logs act-obe-app -f

# 查看最近100行
podman logs act-obe-app --tail 100

# 查看特定时间范围
podman logs act-obe-app --since 10m
```

### Phase 2: 关键错误模式识别

#### 2.1 数据库连接池问题
```bash
# 搜索连接池超时
grep -i "timed out fetching\|connection_limit\|pool_timeout" \
  <(podman logs act-obe-app 2>&1)

# 典型错误
# "Timed out fetching a new connection from the pool"
# 原因: 连接池耗尽 (默认limit=3)
# 解决: 增加DATABASE_URL参数 ?connection_limit=10&pool_timeout=20
```

#### 2.2 Prisma/数据库错误
```bash
# 外键约束错误
grep -i "foreign key\|_fkey\|constraint" \
  <(podman logs act-obe-app 2>&1)

# 典型错误
# "InteractionLog_resourceId_fkey"
# 原因: 前端发送了不合法的resourceId
# 解决: 检查/api/interactive/events路由的校验逻辑
```

#### 2.3 前端资源加载问题
```bash
# sharp库缺失警告
grep -i "sharp is required\|image optimization" \
  <(podman logs act-obe-app 2>&1)

# 解决: npm install sharp，并确保Dockerfile安装依赖
```

#### 2.4 课堂同步问题
```bash
# 搜索课堂相关错误
grep -i "session\|sync\|fail to fetch" \
  <(podman logs act-obe-app 2>&1)

# 检查浏览器控制台
# - ChunkLoadError (代码分割加载失败)
# - Network Error (网络中断)
# - 页面回跳 (状态版本冲突)
```

### Phase 3: 系统资源检查

#### 3.1 容器状态
```bash
# 查看所有容器
podman ps -a

# 检查容器资源使用
podman stats --no-stream

# 重启容器
podman restart act-obe-app
```

#### 3.2 数据库状态
```bash
# 检查PostgreSQL容器
podman ps | grep postgres

# 进入数据库容器检查连接
podman exec -it act-obe-postgres psql -U act_user -d act_obe -c "\conninfo"

# 查看活跃连接
podman exec -it act-obe-postgres psql -U act_user -d act_obe -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';
"
```

#### 3.3 系统资源
```bash
# 内存使用
free -h

# 磁盘空间
df -h

# 系统负载
uptime
```

### Phase 4: 网络连通性检查

```bash
# 测试内网连通性
podman network inspect podman

# 测试数据库连通性
podman exec act-obe-app nc -zv act-obe-postgres 5432

# 测试公网访问
curl -I https://act.adapt-learn.online/api/health
```

## Common Issues & Solutions

### Issue 1: 数据库连接池耗尽
**症状**:
- "Timed out fetching a new connection from the pool"
- 页面加载缓慢，API超时

**诊断**:
```bash
# 检查当前连接数
podman exec act-obe-postgres psql -U act_user -d act_obe -c "
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;
"
```

**解决**:
1. 修改 `.env.server` 中的 DATABASE_URL:
   ```
   DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
   ```
2. 重启容器: `podman restart act-obe-app`

### Issue 2: 课堂状态回跳
**症状**:
- 教师切换步骤后，学生端又跳回旧页面
- 控制台显示 "Ignoring stale state"

**诊断**:
1. 检查 `use-session-progress-channel.ts` 中的版本控制逻辑
2. 确认API返回的 `updatedAt` 字段正常
3. 检查是否存在多个教师同时操作

**解决**:
- 参考 `docs/L2D-STABILIZATION-DEPLOY.md` 中的版本控制机制
- 确保PATCH请求期间轮询暂停

### Issue 3: 前端Chunk加载失败
**症状**:
- "ChunkLoadError: Loading chunk X failed"
- 白屏或部分功能无法使用

**诊断**:
```bash
# 检查Next.js构建输出
ls -la .next/static/chunks/

# 检查Nginx/Podman端口映射
podman port act-obe-app
```

**解决**:
1. 重新构建: `npm run build`
2. 清除浏览器缓存
3. 检查CDN/代理配置

### Issue 4: 事件追踪API失败
**症状**:
- 学生操作无法记录
- "InteractionLog_resourceId_fkey" 错误

**诊断**:
```bash
# 检查事件API日志
grep -A 5 "Interactive Events API" \
  <(podman logs act-obe-app 2>&1)
```

**解决**:
- 检查前端发送的resourceId格式（应为CUID）
- 确认降级处理逻辑正常工作

## Log Analysis Commands

### 快速诊断脚本
```bash
#!/bin/bash
# 保存为 diagnose.sh

echo "=== AI-OBE Platform Diagnostics ==="
echo ""

echo "[1] Container Status:"
podman ps -a | grep act-obe

echo ""
echo "[2] Recent Errors:"
podman logs act-obe-app --tail 50 2>&1 | grep -i "error\|fail\|exception" | tail -10

echo ""
echo "[3] Database Connections:"
podman exec -i act-obe-postgres psql -U act_user -d act_obe -c "
SELECT
  state,
  COUNT(*)
FROM pg_stat_activity
GROUP BY state;
" 2>/dev/null || echo "Cannot connect to DB"

echo ""
echo "[4] System Resources:"
echo "Memory:"
free -h | grep "Mem:"
echo "Disk:"
df -h / | tail -1
```

### 日志过滤模板
```bash
# 特定时间段
grep "2026-03-18T10:" <(podman logs act-obe-app 2>&1)

# 特定API路由
grep "/api/session" <(podman logs act-obe-app 2>&1)

# 特定用户操作
grep "userId.*session" <(podman logs act-obe-app 2>&1)
```

## Investigation Checklist

- [ ] 确定问题范围（前端/后端/数据库/网络）
- [ ] 获取相关时间段的完整日志
- [ ] 识别错误模式和频率
- [ ] 检查系统资源使用情况
- [ ] 验证配置文件（.env.server）
- [ ] 测试关键API端点
- [ ] 确认容器和数据库状态
- [ ] 制定修复方案并验证

## Emergency Contacts & Escalation

1. **立即止血**: 重启容器 `podman restart act-obe-app`
2. **回滚部署**: 使用上一个镜像版本
3. **数据库紧急处理**: 终止所有连接 `pg_terminate_backend()`
4. **查看详细文档**: `docs/L2D-STABILIZATION-DEPLOY.md`
