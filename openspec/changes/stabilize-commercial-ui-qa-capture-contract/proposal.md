## Why

正式 adaptive-path 产品 QA 捕获依赖共享 AppShell Dock 的副作用注册，却只等待页面根节点，并且默认连向与最近成功记录不一致的端口。这使采集结果取决于旧服务或水合时序，无法作为可复现的门禁证据。

## What Changes

- 为共享 adaptive-path 13 状态捕获工具明确服务 URL、同源服务修订证明和 Dock 就绪合同。
- 在截图前等待可观察的、可交互的共享 Dock 状态；超时保留诊断并失败。
- 为 URL、延迟注册、超时和证明绑定补充定向测试。
- 不改变 commercial UI gate 的状态数、通过条件或产品页面行为，也不更新任何产品证据。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `commercial-ui-governance-gates`: 规定受治理的浏览器捕获必须绑定明确的目标服务和最终代码输入，并在 AppShell Dock 可观测后截图。

## Impact

- `scripts/tests/capture-adaptive-path-product-qa.ts`
- 开发环境专用的同源 revision probe 及其共享证明计算
- 该捕获工具的定向测试
- `commercial-ui-governance-gates` 规范
- #1322 基线 PR；不包含 #1167 的产品行为或任何新的 QA 截图工件。
