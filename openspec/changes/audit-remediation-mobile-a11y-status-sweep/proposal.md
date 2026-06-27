## Why

大量剩余 finding 是横向 status/live、移动长页、宽表、dialog/focus 和浮动工具避让问题。若先做横向补丁，会掩盖业务动作本身未闭环；因此本变更作为垂直整改后的收尾。

## What Changes

- 统一页面级 status/live 验收要求和状态播报查询方式。
- 补齐 dialog/menu/floating panel focus containment、Escape 和 opener focus restoration。
- 对移动长页、宽表和主动作区做最后一轮 320px/390px 审计回归。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-mobile-a11y-shell`: 要求横向收尾只在垂直状态机就绪后关闭剩余移动/a11y finding。
- `platform-status-and-evidence-ui`: 要求状态 primitives 在关键动作中具备可验证 live/status 输出。
- `platform-design-system-and-shell`: 要求全局浮动工具、AI 侧栏、移动导航和页面主动作区遵守统一避让规则。

## Impact

影响 AppShell, floating controls, Global AI sidebar, dialog/menu primitives, audited mobile routes, Playwright/DOM a11y checks, and audit evidence。
