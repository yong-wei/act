## Context

React Doctor error-only 扫描显示服务端共有 19 条 error：

- `server-auth-actions`: 12 条，集中在 `src/app/actions/mission.ts` 和 `src/app/actions/control-odyssey.ts`。
- `nextjs-no-side-effect-in-get-handler`: 4 条，涉及 AI session 创建、治理状态查询统计累加、教师 heatmap/insights 累加器。
- `server-no-mutable-module-state`: 3 条，涉及 `src/app/actions/control-odyssey.ts` 中模块作用域数组或对象默认值。

这些不是 warning 级可维护性建议，而是安全和请求语义边界问题。实现时应先确认每个命中点是否真实可被外部调用；若命中为误报，必须用代码结构或显式测试证明其安全，而不是简单关闭规则。

## Goals / Non-Goals

**Goals:**

- 消除 React Doctor 对服务端安全相关规则的 error 级命中。
- 为所有 exported Server Actions 建立一致的认证和授权入口。
- 保证 GET route handler 不执行创建、写入、统计累加、缓存突变等副作用。
- 保证服务端模块作用域不暴露可跨请求共享并被误改的可变默认引用。
- 以本地命令验证：定向服务端测试通过，`react-doctor --no-warnings` 不再报告本变更范围内的服务端 error。

**Non-Goals:**

- 不处理 React 组件状态同步、effect cleanup、ARIA role 等客户端 error；这些由后续变更处理。
- 不把 React Doctor 接入 GitHub Actions。
- 不把所有 warning 级建议纳入本轮修复。
- 不重构 Control Odyssey 或 Mission 的产品玩法、积分规则、榜单规则。

## Decisions

1. **Server Action 统一先鉴权，再执行业务逻辑。**

   Exported Server Actions 可以被客户端直接调用，不能依赖调用页面的可见性或 UI 入口。实现应复用项目现有 session/auth helper，或新增窄范围 helper，例如 `requireAuthenticatedUser()`，并让每个 action 在访问用户数据、积分、AI 历史、排行榜提交前通过认证。凡是 action 接收 `userId`、`simulationLogId`、history id 或类似 caller-supplied scope 参数，都必须验证该参数属于当前用户或当前授权角色可访问范围；不能只检查“已登录”。公开榜单读取若确实允许匿名访问，应改为非敏感 route 或显式 public helper，并通过测试证明不会泄露个人数据。

2. **GET route handler 保持读取语义，副作用改为 POST 或移出请求路径。**

   React Doctor 标记的 `.create()`、`accumulator.set()` 等操作需要逐项判断：真正创建 session 或写入记录的逻辑应改为 POST；只为性能或统计使用的内存累加器应替换为请求局部变量、纯计算结果、或由后台任务维护的只读快照。不能用 GET 承载会因预取、刷新、CSRF 触发的状态变化。

3. **模块作用域默认结构使用不可变常量或工厂函数。**

   对数组、对象这类引用类型，服务端 action 不应把模块级默认值直接传给可变业务状态。实现应采用 `Object.freeze`/`as const` 的只读结构，或每次请求通过工厂函数返回新对象，避免用户之间共享引用。

4. **React Doctor 是验收工具，不是修复设计的唯一依据。**

   每个命中点需要用代码语义确认真实风险。误报可以通过改写代码形态或最小 inline disable 处理，但 inline disable 必须附带说明和测试证据；默认路径是修复真实问题。本轮验收绑定本次调查实际使用的 React Doctor `0.5.1`，避免 `@latest` 后续规则变化把本轮 114 条 error 清理目标变成漂移目标。

## Risks / Trade-offs

- **GET 改 POST 可能影响现有客户端调用。** → 先通过 `rg` 查全调用点，保持读取 endpoint 兼容或同时迁移客户端。
- **排行榜类接口可能本来设计为公开读取。** → 区分读取与写入；公开读取必须只返回可公开字段，写入与个人历史必须鉴权。
- **模块默认值冻结可能暴露既有代码的隐式 mutation。** → 加测试覆盖初始化与升级路径，必要时改为工厂函数而不是冻结共享对象。
- **React Doctor 对少数模式可能误报。** → 不以关闭规则作为默认方案；只有在安全测试和代码路径证明后才局部豁免。
