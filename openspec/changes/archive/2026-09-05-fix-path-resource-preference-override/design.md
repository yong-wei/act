# Design: fix-path-resource-preference-override

## 根因模型

- 面板默认值（`adaptive-path-generation-panel.ts:31`）与「主动选择」共用同一状态字段 `resourcePreference`，页面把该字段无条件写入生成请求体（`adaptive-practice/page.tsx:4283`），服务端无从区分默认值与用户选择。
- 服务端解析链（`konling-agent-runtime.ts:4234`）`explicit ?? intent ?? starterPathPolicy.preferredResourceTypes`，来源标注仅 `request/intent/fallback`；learner-state 的画像偏好特征（`buildResourcePreference` 从治理学习事实推断）不在链上。

## 决策

- **区分「选择态」与「展示态」。** 面板状态增加来源标记（`untouched | user-selected`，URL 参数视为 user-selected）；提交时仅在 `user-selected` 时携带 `resourcePreference`。默认值保留为 UI 展示提示（可标注「系统建议，未提交」）。
- **画像层插入位置。** 解析链改为 `explicit(request) → profile → intent → system-default`。画像层来自 learner-state 资源偏好特征，设证据数/置信门槛（复用偏好特征的 evidenceCount 与 confidence，阈值实现时定标），未达门槛下落 system-default。intent（自然语言映射）保持优先于 system-default、低于 profile：显式口头偏好与画像冲突时以画像为准不符合直觉——此处决策为 intent 仍高于 profile 仅当自然语言显式点名资源类型；实现时以 `intentMapping.resourcePreferences` 非空为准。来源枚举扩展为 `request | profile | intent | fallback`。
- **生效面在资源排序。** 解析出的偏好进入规划器 `preferredResourceTypes` 等价输入（`plan-learning-path` 消费点），resource ranking 已有类型偏好加权，无需新机制；回归测试直接断言候选路径 `modalityMix/resourceMix` 随偏好变化。
- **来源透出复用 `configurationRequests`。** `resource-preferences` 条目的 source 扩展 `profile` 值；推荐依据与生成响应携带该来源，页面渲染说明文案。
- **与 #1984 的依赖。** 画像偏好层读取主画像可用性：`UNAVAILABLE` 时跳过 profile 层、来源如实标注 fallback。两变更可并行实现，本变更的 profile 分支以 #1984 的可用性合同为输入，先行实现时以「偏好特征证据门槛」占位判定。

## 测试策略

- 面板与页面：默认态请求体不含 `resourcePreference`；URL 参数/手动切换后携带；来源说明渲染。
- 服务端：四层优先级解析单测（request 显式、profile 达门槛、intent 点名、默认下落），`resourcePreferenceSource` 断言。
- 端到端回归：同一画像下「不提交」与「显式选择视频/讲义」两组生成的资源组合差异断言。
