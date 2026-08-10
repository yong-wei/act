## Context

adaptive-path 的 13 状态产品 QA 捕获需要验证禁用的共享 Konling Dock。页面由 AppShell 在副作用中注册该控件，但现有 runner 只等待页面根节点，且默认服务地址与历史成功捕获不一致。因而它可能请求旧服务或在注册前检查 DOM。

`/knowledge` 的证据矩阵同时追踪 adaptive-practice 页面。该页面由 #1169 修改，所以本变更不得提交在 integration 上采集、会在 #1169 组合修订中立刻失效的产品证据。

## Goals / Non-Goals

**Goals:**

- 使共享 adaptive-path 捕获显式绑定调用方提供的服务 URL 和当前代码输入。
- 在共享 Dock 注册、可见且禁用后才允许相应状态截图。
- 为 URL、注册时序、超时诊断和证明绑定建立可测试合同。

**Non-Goals:**

- 不改变 commercial UI governance 的门禁条件、状态矩阵或失败语义。
- 不修改 adaptive-practice、知识工作台、Konling runtime 或导航产品行为。
- 不生成 `/knowledge` 或 adaptive-path 的待审产品截图和摘要；它们由 #1169 的最终组合修订生成。

## Decisions

### 仅修复共享 runner

本基线 PR 只修改 adaptive-path capture runner 及其测试。`/knowledge` 的证据绑定 adaptive-practice，因此若在 integration 上更新会被 #1169 立即淘汰。基线 PR 合并后，#1169 必须在组合后的最终 HEAD 重采两组证据。

### 目标服务必须显式且可核验

runner 接受明确的 base URL，并在 capture manifest 中记录实际地址。缺失、不可达或与页面最终地址不一致时失败；不再静默依赖过期端口的默认服务。

### Dock 就绪使用语义信号，不使用固定延时

对于声明需要可见 Dock 的 capture state，runner 等待共享 Dock 和其 primary Konling trigger 出现、可见且保留禁用状态。移动执行态因碰撞策略有意隐藏 Dock，不以可见性作为该状态的通过条件。超时错误必须包含目标 URL、可观察的 Dock 状态和缺失控件，便于区分服务地址与页面注册问题。

### 证明绑定保持现有 fail-closed 原则

capture 前验证干净工作树和当前源输入；capture 后仍由既有商业 UI gate 校验最终工件。runner 修复本身不允许写入或伪造生产证据。

### 同源开发服务 revision probe

端口可达不能证明服务来自当前工作树。新增仅在 `NODE_ENV=development` 且显式启用本地 QA bridge 时可用的同源 probe：服务进程从自身工作目录现场计算固定路径集合的 commit、tree、source fingerprint 与 clean 状态。生产环境无论配置如何均返回 404，probe 不接受任何 revision 输入，且只返回固定格式的摘要、使用 `no-store`。

runner 从目标服务 URL 推导 probe URL，在捕获前后都请求并逐项比较服务摘要与本地 clean 摘要。任一缺失、不相等或捕获期间变化均使本次运行失败；manifest 写入已验证的服务摘要，而非 runner 单方面的 Git 读取结果。该机制防范误连旧服务或错误工作树，不把本机恶意进程伪造响应作为本次威胁模型。

### 临时分阶段与事务式产品证据发布

截图、manifest 和 visual signals 始终先写入系统临时 staging 目录。服务 pre/post probe、本地最终 clean proof、源文件 SHA 和状态矩阵全部通过后，才允许向固定版本化根 `artifacts/commercial-ui/adaptive-path-product-qa-516` 发布。调用方只能提供该根内的相对子路径；路径穿越、仓库外目标和符号链接路径均拒绝。manifest 只记录该根下的仓库相对逻辑路径，不记录 staging 路径或绝对本机路径。

发布阶段先把已哈希的 staging 内容复制到目标父目录的 sibling staging，再校验每个文件 SHA，随后以备份、rename、失败恢复完成目录级原子替换。发布失败时恢复旧目录，不留下半套产品证据。post probe 后不再写入仓库，直至上述发布事务开始；未设置输出子路径时仍可将完整捕获发布到系统临时目录，供非产品验证使用。

## Risks / Trade-offs

- [本地服务未从当前工作树启动] → 显式 URL 与不可达诊断使 capture 失败，而非生成错误修订的工件。
- [Dock 未来改为异步或改名] → 定向测试覆盖等待与超时合同；缺少语义 trigger 时 fail closed。
- [修复后仍有人改动受跟踪源] → #1169 的最终捕获和完整门禁在最终组合 HEAD 重复校验。
