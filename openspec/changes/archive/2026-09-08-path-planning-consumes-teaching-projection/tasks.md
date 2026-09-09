## 1. 绑定适配器与身份映射

- [x] 1.1 实现教学投影绑定适配器：读取活投影 resources/bindings/cards-index，按确定性映射表（`act:handout:*`→`runtime-handout:*`、`act:card:*`→`knowledge-card:*`、`act:video|audio:*`→`runtime-media:*`、`act:simulation:arena-task-*`→`arena-task:*`、`act:textbook-section:*`→textbook_section）产出 ResourceNode 补丁
- [x] 1.2 实现 canonical↔旧节点 id 桥加载：只读 cutover `denominator.json` 精确行，断言 capture 修订与基线 hash 字段，桥缺失/版本不符时该族为空并标记 limited
- [x] 1.3 课堂仿真显式映射表落地；无条目跳过并按族计数，禁止模糊匹配
- [x] 1.4 适配器降级路径：投影输入缺失或指针不一致时族状态进诊断，路径标记 limited，不伪造候选

## 2. 注册表与类型扩展

- [x] 2.1 ResourceNode 类型枚举新增 `exercise`；`mergeOverlappingSources` 合并适配器补丁时不动 `pathEligible`、不覆盖审计/评审字段
- [x] 2.2 `resolveAdaptivePathGenerationRegistry` 追加 `loadCandidateSourceFamily('teaching-projection-bindings', ...)` 第五族并汇入 `buildResourceNodeRegistryFromTeachingResources`
- [x] 2.3 候选池诊断按资源族报告计数，含教学投影绑定族与各映射/跳过明细

## 3. 目标匹配与 mix

- [x] 3.1 `nodeMatchesGoal` 目标集合纳入 canonical 目标：经桥映射回旧节点 id 后参与匹配；无桥映射的 canonical 目标计入诊断限制
- [x] 3.2 各注册目标 `allowedResourceMix`（AUTOCONTROL/FOUNDATION/control-correction/frequency-response-foundations 及插件策略）扩展 video/audio/exercise
- [x] 3.3 生成期解释追加绑定来源信号（canonical id 引用），不改节点级决策投影字段（与 `explain-active-path-node-decisions` 的边界）

## 4. 评审治理

- [x] 4.1 `resource-node-path-readiness-review-batch.ts` 扩容覆盖 video/audio/exercise 及新增仿真节点并执行评审
- [x] 4.2 治理顺序断言：对应族评审未覆盖时 mix 扩展不生效，准入层 fail closed

## 5. 验证

- [x] 5.1 新增适配器映射、桥降级、canonical 目标匹配、准入不绕过的聚焦测试
- [x] 5.2 现有路径测试全量回归不回退；`rtk npm run typecheck` 通过
- [x] 5.3 控灵 `generate_learning_path` 端到端验证：生成路径可包含讲义/卡/视频/音频/习题/仿真/教材节，候选计数按资源族报告
- [x] 5.4 `rtk openspec validate path-planning-consumes-teaching-projection --type change --strict` 通过
