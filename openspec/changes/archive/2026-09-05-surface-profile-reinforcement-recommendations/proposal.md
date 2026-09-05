## Why

学生个人中心已经有“个性化补强路径”展示区、受治理推荐引擎和推荐资源卡映射函数，但用户画像 API 始终返回空资源数组。结果是学习证据无法转化为下一步学习行动，学生只能看到泛化的自适应练习入口，无法获得与当前学习状态相匹配的资源建议。

## What Changes

- 让个人中心服务端投影复用 Personalization 的受治理推荐用例，返回当前学生可执行的资源卡片。
- 保留推荐的理由、优先级、置信度、证据窗口、来源覆盖和学生归属边界。
- 在缺失、过期、不完整或不可用证据下返回明确的降级结果或证据收集行动，不把通用资源伪装成精确个性化推荐。
- 为推荐资源与个人中心页面增加服务端、路由和浏览器验收，验证资源卡片可进入真实学习流程。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-center-ui`: 个人中心的个性化补强区域必须展示受治理推荐结果，并在证据不足时呈现明确限制和可执行的学习行动。
- `evidence-driven-personalization`: 个人中心消费推荐时必须保留受治理推荐的证据理由、置信度和来源覆盖信息，并保持学生归属边界。

## Impact

- 影响 `src/app/api/user/profile/route.ts`、`src/lib/data-governance/profile-center.ts`、个人中心页面及相关测试。
- 复用现有 Personalization public API 和 Learning Record/evidence ports，不新增推荐模型或旁路数据存储。
- 需要补充推荐失败、证据不足、学生归属和资源入口可达性的验证。
