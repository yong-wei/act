# Tasks

- [x] 1. learner-state 读结果向路径生成与学习状态接口透出 `primaryPortraitState/availabilityReason`；legacy 兼容向量从能力维度与缺陷推断输入中剥离
- [x] 2. `inferDeficits` 能力类目标三态化：`competency-deficit` / `competency-maintenance` / `competency-no-portrait-evidence`；无画像证据不再输出 0 分缺陷
- [x] 3. 推荐依据构建：画像可用时 `recommendationProvenance` 补充「维度/缺口 → 路径安排」解释映射；不可用时切换通用路线语义
- [x] 4. 路径中心页面呈现个性化可用性状态（不可用提示与原因、通用路线语义、可用时解释链），320px 状态可用
- [x] 5. fence 收敛验证：提供脚本或治理面板状态证明 fence → APPLY COMPLETED → 画像可读，纳入发布验收清单
- [x] 6. 回归测试：画像不可用/可用两态的规划器、学习状态接口与页面合同测试；运行 `typecheck` 与相关套件
