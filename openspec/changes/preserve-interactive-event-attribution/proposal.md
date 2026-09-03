## Why

独立互动学习资源在访客→登录、或学生 A→学生 B 的身份切换中，会把旧身份产生的互动事件错误归属到新会话名下（#1913，P1：身份归属、学习证据真实性、隐私与数据完整性）。

根因：`useInteractiveTracking` 的 `storageKey` 已按身份分键，但 `eventsRef` 是单一内存引用；恢复 effect 只在新键含已存数组时才替换引用——新键无数据时旧身份队列原样残留，随后被独立资源（`persistWithoutSession`）的合法同步通道以新会话身份提交。服务端 `POST /api/interactive/events` 本就以认证会话为唯一归属来源（401 拒未登录、忽略客户端身份字段），因此错误归属完全由客户端队列残留造成。

## What Changes

- 恢复 effect 改为在身份键（`storageKey`）变化时无条件把队列重置为新键的存储态：新键无数据即清空，旧身份队列不再被新身份提交或继续累计。
- 同一身份的刷新与短暂网络失败恢复行为不变（仍从本键 localStorage 恢复合法待同步事件）。
- 服务端归属语义保持不变并以测试固化：未登录写入 401；数据库归属一律取认证会话，不读客户端身份字段。
- 路由测试补充身份切换契约用例；客户端 hook 测试补充访客→登录与用户 A→用户 B 的队列重置回归。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `interactive-governance-evidence`: 增加互动事件身份归属要求——事件只能归属产生时已确认的身份上下文，客户端队列不得跨身份提交，服务端以认证会话为唯一归属来源。

## Impact

- `src/features/interactive/hooks/useInteractiveTracking.ts`（恢复 effect 整队重置）。
- `src/app/api/interactive/events/__tests__/route.test.ts`（未登录拒绝与归属权威已覆盖/补充）。
- `src/features/interactive/__tests__/interactive-tracking.test.tsx`（身份切换回归）。

## Non-Goals

- 不迁移或清洗已写入的历史错误归属数据（如需另行立项）。
- 不改变服务端归属模型、课堂事件链路或教师复盘授权。
- 不为访客事件建立服务端暂存或转正机制；访客事件保持本地临时状态。
