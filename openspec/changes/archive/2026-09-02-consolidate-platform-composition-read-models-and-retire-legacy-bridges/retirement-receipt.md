# Read-Model Map & Bridge Retirement Receipt — consolidate-platform-composition-read-models-and-retire-legacy-bridges

## Before / After read-model owner map

| 组合面 | 唯一 owner（select existing，未新建） | 证据 |
|--------|--------------------------------------|------|
| 平台 UI/read-model 类型合同（privacy、source coverage、provenance、replay、protocol、evaluation、readiness） | `src/components/platform/platform-ui-contracts.ts` | `platform-ui-contracts.test.ts` |
| 角色导航投影 | `src/lib/platform-role-navigation.ts`（`getPlatformRouteNavigation` / `resolvePlatformRouteInventory`） | `platform-role-navigation.test.ts` |
| AppShell 组合渲染与角色可见性 | `src/components/platform/app-shell.tsx` | `platform-appshell-contract.test.ts`（路由矩阵全覆盖） |
| Role workspace shell | `src/components/platform/role-workspace-shell.tsx` | appshell governance 代表矩阵 |
| 状态/证据呈现 | `src/components/platform/status-and-evidence.tsx` + `action-status.tsx` | platform contracts 测试 |
| z-index 层叠 | `src/components/platform/platform-layers.ts` | 单一常量表，无页面私有层叠 |

页面/layout 中的 `role === ...` 分支是 SSR 认证/授权门禁与重定向（design 决策 3 指定由 SSR page 负责），不是 read model 组合，保持不动。

## 退役的 legacy bridge / 死代码

| 删除项 | 退役理由（消费者证据） |
|--------|------------------------|
| `src/components/ai/index.ts` | 死 barrel：全仓零 import（所有消费者直接路径引用具体组件） |
| `src/components/ai/konling-call-button.tsx` | 零生产/测试消费者（`KonlingCallButton`/`KonlingMiniButton`/`KonlingTextButton` 全仓零引用，唯一定义处） |
| `src/components/ai/konling-sidebar.tsx` | C29 保留面清单成员，当时仍有 caller；此后后续 change 移除了全部生产消费者，仅剩死 barrel re-export 与两个源码扫描测试引用。零生产 caller 的 legacy bridge，按本 change 标题授权退役 |
| `KonlingWelcome` / `KonlingAvatarGroup`（konling-avatar.tsx 内） | 零消费者死导出（`KonlingAvatar` 本体仍活） |

## 保留的 ingress adapter 及删除条件

| 保留项 | 理由 | 删除条件 |
|--------|------|----------|
| `src/hooks/useLegacyChat.ts` | C29 登记的 documented bounded ingress adapter（legacy Message 形状 → canonical `@ai-sdk/react useChat`）；`legacy-chat-bridge-retirement.test.ts` 断言其无会话 store/provider/业务权威 | 最后一个保留 surface（copilot page/panel、global-ai-sidebar）迁移到 canonical hook 时 |
| `src/components/ai/global-ai-sidebar.tsx` 等 3 个保留面 | 活的生产 surface，单一 `/api/ai/chat` endpoint | 由后续 AI workspace change 决定 |
| `konling-continuity-card.tsx` | `commercial-ui-capture-revision.ts` 治理捕获配置按名引用 | UI 治理捕获清单退役时 |

## 测试同步

- `legacy-chat-bridge-retirement.test.ts`：`RETAINED_SURFACES` 4→3（konling-sidebar 退役移出保留清单）。
- `ai-task-boundary-ui-source.test.ts`：移除对已删除 sidebar 的 5 处源码扫描断言，其余 sanitize/citation/共享渲染断言不变。

## 行为等价证据

- 平台与边界测试 106/106（appshell contract、role navigation、ui contracts、chat bridge retirement、ai task boundary）。
- `test:appshell-governance`（vitest 3 文件）与商业 UI 治理引用核对通过。
- 删除文件全仓零残留引用（rg 复核）。
- `npm run typecheck` 0 错误；`npm run lint` 通过。

## Rollback

单 commit revert 恢复 3 个文件与 2 个死导出（`classroom/index.ts` barrel 经复核有 7 处 `@/components/classroom` 导入，保留不删）；无数据、schema、合同或权限变化。

## 范围裁剪（review r2：未交付要求不得进入主规范）

原 spec delta 的 Requirement "Platform composition has one bounded read-model owner"（单一统一组合合同）未在本轮交付，已从 spec delta 移除而非同步为主规范能力；统一组合合同 + knowledge/resource/teaching/AI presentation surface 迁移由后续 change 承接。tasks 2.1–2.3 已按实际交付语义改写（owner 登记 + 零消费者 bridge 退役），归档与主规范一致。

## 未交付残余（C34+ 前置状态声明）

本轮交付 = 零消费者 legacy bridge/死代码退役 + 既有组合 owner 登记（platform-ui-contracts / platform-role-navigation / app-shell / role-workspace-shell 分立持有各面）。

**未交付**：统一的 platform composition read-model 契约模块（单一入口组合多领域 projection、revision identity、privacy 分类与 unavailable 状态）未作为独立合同实现；knowledge/resource、teaching、AI presentation surface 尚未迁移到该合同。`platform-composition-read-model` spec requirement 1 的完整满足需要后续 change 实现该合同并迁移上述 surface；在此之前不得将"single composition contract"视为已交付能力。

理由：本轮 production diff 为行为保持型退役；为单个 shell 构造 facade 式合同比显式残余更糟（review thread 记录该取舍）。
