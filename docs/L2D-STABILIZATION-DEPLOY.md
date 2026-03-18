# L-2d 课堂服务不稳定整改 - 部署指南

## 已完成的代码修改

### Phase 1: P0 立即整改（已完成）

#### Task 1.1: Prisma连接池配置 ✅
**文件**: `src/lib/prisma.ts`
- 添加了连接池参数说明文档
- 服务端需要在 `.env.server` 中配置DATABASE_URL：
  ```
  DATABASE_URL="postgresql://act_user:act_pass@act-obe-postgres:5432/act_obe?connection_limit=10&pool_timeout=20"
  ```

#### Task 1.2: InteractionLog外键错误修复 ✅
**文件**: `src/app/api/interactive/events/route.ts`
- 添加了 `validateResourceId()` 函数进行CUID格式校验
- 添加了 `logDegradedEvent()` 降级日志函数
- 修改了POST处理逻辑：
  - 对resourceId进行格式校验
  - 不合法的resourceId不入主表，只记录到控制台
  - 避免外键约束错误导致请求失败
  - 返回成功但标记degraded数量，防止前端重试风暴

#### Task 1.3: 教师端页面回跳修复 ✅
**文件**:
- `src/app/api/session/[sessionId]/route.ts`
- `src/features/interactive/session-framework/session-contract.ts`
- `src/features/interactive/session-framework/use-session-progress-channel.ts`

**修改内容**:
1. API响应添加 `updatedAt` 字段用于版本控制
2. PATCH请求强制更新 `updatedAt` 时间戳
3. 前端hook实现版本控制：
   - `lastKnownTimestampRef`: 记录已知最新状态时间戳
   - `isPatchingRef`: PATCH请求期间暂停轮询
   - `pollSkipCountRef`: PATCH成功后跳过接下来2次轮询
   - 服务器状态如果比已知最新状态旧（>500ms容差），则忽略

#### Task 1.4: sharp库安装 ✅
**文件**: `package.json`
- 添加了 `sharp: "^0.33.0"` 依赖

---

## 远端服务器部署步骤 (121.40.124.135)

### 1. 修改环境变量
```bash
ssh root@121.40.124.135
cd /home/projects/act
```

编辑 `.env.server`：
```bash
# 修改前
DATABASE_URL="postgresql://act_user:act_pass@act-obe-postgres:5432/act_obe"

# 修改后
DATABASE_URL="postgresql://act_user:act_pass@act-obe-postgres:5432/act_obe?connection_limit=10&pool_timeout=20"
```

### 2. 重新构建并部署
```bash
# 构建镜像
podman build -t act-obe-app:latest .

# 重启容器
podman restart act-obe-app

# 检查日志
podman logs act-obe-app -f
```

### 3. 验证检查清单

#### 检查1: 连接池配置生效
```bash
podman logs act-obe-app 2>&1 | grep -i "connection\|pool\|timeout"
# 预期: 不再出现 "Timed out fetching a new connection"
```

#### 检查2: 外键错误消失
```bash
podman logs act-obe-app 2>&1 | grep -i "InteractionLog_resourceId_fkey"
# 预期: 无输出（没有外键错误）
```

#### 检查3: sharp警告消失
```bash
podman logs act-obe-app 2>&1 | grep -i "sharp is required"
# 预期: 无输出（没有sharp警告）
```

#### 检查4: 页面回跳修复验证
1. 教师端打开课堂（L-2d课程）
2. 学生端加入课堂
3. 教师快速切换步骤（第9页→第10页→第11页）
4. 观察学生端是否跟随更新且不回跳
5. 检查浏览器控制台是否有 `[SessionSync] Ignoring stale state` 日志

---

## 架构说明

### 版本控制机制
```
教师操作 (PATCH)
    ↓
设置 isPatchingRef = true (暂停轮询)
    ↓
乐观更新UI + 发送PATCH请求
    ↓
PATCH成功 → 更新 lastKnownTimestampRef → pollSkipCountRef = 2
    ↓
设置 isPatchingRef = false (恢复轮询)
    ↓
轮询恢复，但跳过2次 → 给服务器时间传播状态
    ↓
正常轮询，检查时间戳，忽略旧状态
```

### 降级事件处理
```
前端发送事件
    ↓
校验resourceId格式 (CUID: c开头 + 24字符)
    ↓
├─ 合法 → 批量写入InteractionLog
├─ 不合法但有resourceKey → 写入resourceId=null, 保留resourceKey
└─ 不合法且无resourceKey → 降级日志（不入库）
    ↓
返回 { success: true, count: X, degraded: Y }
（即使全部降级也不返回错误，避免前端重试风暴）
```

---

## Phase 2 & 3 计划（待实施）

### Phase 2: P0 关键架构调整（3天内）
- Task 2.1: /api/auth/session 添加缓存（LRU，TTL 60s）
- Task 2.2: /api/interactive/events 改异步批量

### Phase 3: P1 架构升级（一周内）
- Task 3.1: 部署Redis容器
- Task 3.2: 课堂状态迁移到Redis
- Task 3.3: 实现WebSocket/SSE推送
- Task 3.4: 添加限流和退避

---

## 紧急联系

如部署后仍出现问题：
1. 立即检查日志：`podman logs act-obe-app -f`
2. 回滚命令：`podman restart act-obe-app`（使用旧镜像）
3. 连接池紧急调整：直接修改.env.server并重启
