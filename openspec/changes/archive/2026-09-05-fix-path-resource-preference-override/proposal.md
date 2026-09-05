## Why

Issue #1985 反馈：生成学习路径时页面主动提交固定的「知识卡、练习、仿真」资源偏好，该参数优先级高于服务端读取的学生资源偏好，学生真实的视频、讲义或仿真偏好无法稳定影响路径结果，且无法区分偏好来源。

根因（已调查确认）：

- 生成面板默认状态固定携带 `resourcePreference: ['knowledge_card', 'adaptive_quiz', 'simulation']`（`src/features/personalization/path-planning/adaptive-path-generation-panel.ts:31`）；仅 URL 带 `pathResources` 参数时覆盖，否则一律使用该固定默认值。
- 页面生成请求无条件提交 `resourcePreference: pathGenerationPanel.resourcePreference`（`src/app/assessment/adaptive-practice/page.tsx:4283`），默认三类型因此始终以显式请求身份到达服务端。
- 服务端优先级链（`src/lib/konling-agent-runtime.ts:4234`）为 `request（显式参数）→ intent（自然语言意图）→ fallback（注册 goal 静态 preferredResourceTypes）`，标注来源 `request/intent/fallback`；learner-state 从学习事实推断的资源偏好（`learner-state/internal.ts` `buildResourcePreference`）从未进入该链。
- 结果：学生未主动修改时固定默认值压倒一切；画像偏好（issue 中观察到的低置信 `assessment` 偏好）既不稳定生效，也无法在推荐依据中被解释。

## What Changes

- 默认不提交：学生未主动选择资源偏好（无 URL 参数、无手动切换）时，生成请求不携带 `resourcePreference`；面板默认值仅作为 UI 展示态，不进入请求体。URL 参数与手动切换视为主动选择，可覆盖画像偏好。
- 优先级链加入画像层：`request（用户显式选择）→ profile（learner-state 资源偏好特征）→ intent（自然语言）→ system-default（starterPathPolicy.preferredResourceTypes）`；画像层仅在偏好特征达到证据/置信门槛时生效，否则下落到系统默认。
- 来源透明：生成结果与推荐依据标明本次资源偏好来源（用户选择 / 画像推断 / 自然语言 / 系统默认），复用 `configurationRequests` 的 source 结构；页面展示来源说明。
- 偏好生效：画像资源偏好提高对应资源类型在候选路径资源组合中的优先级（resource ranking 消费），保证「偏好 → 路径资源组合」可观察地变化。
- 偏好切换回归测试：至少一组画像偏好（如视频/讲义）与默认不提交场景的对照，证明候选路径资源组合随偏好改变；主动选择覆盖画像偏好的断言。

## Capabilities

### Modified Capabilities

- `adaptive-learning-center-ui`: 生成面板默认态不提交资源偏好；生成结果呈现偏好来源说明（用户选择/画像推断/系统默认）。
- `adaptive-learning-path-planning`: 服务端资源偏好优先级链合同（request → profile → intent → system-default）与画像偏好对资源排序的生效要求。

## Impact

- `src/features/personalization/path-planning/adaptive-path-generation-panel.ts`（默认态语义与提交行为）、`src/app/assessment/adaptive-practice/page.tsx`（请求体与来源展示）。
- `src/lib/konling-agent-runtime.ts`（优先级链与 `resourcePreferenceSource` 扩展）、路径资源排序消费（`resource-ranker` / 规划器 preferredResourceTypes 输入）。
- 偏好切换回归测试（接口 + 页面）；不改变 checkpointPreference、difficultyRhythm 的既有来源语义，不修改 learner-state 偏好推断算法本身。
- 画像偏好层的生效依赖 Issue #1984 的主画像可用性合同：画像不可用时该层下落为系统默认并如实标注来源。
