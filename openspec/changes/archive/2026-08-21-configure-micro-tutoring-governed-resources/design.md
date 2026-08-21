## Context

现有编排从 `TeachingResource`、资源注册表、规范节点和错因选择学习资源，但题库扩展后缺少统一的资源投影与动作语义。资源内容可能来自知识卡、讲义片段、互动资源或受治理练习；它们的 authority 不能被一份手写微辅导清单替代。

## Goals / Non-Goals

**Goals:**

- 从现有资源真源派生可重建、可审计的微辅导资源投影。
- 为九个 practice-v1 规范节点及其错因提供真实、学生可达的 5–10 分钟学习动作。
- 让编排、覆盖审计和微干预事件使用同一资源/action 身份。

**Non-Goals:**

- 不复制每道题的资源，不新增组件路径注册方式。
- 不把打开或完成资源解释为掌握。
- 不运行时生成正式学习资源，不改变学习路径或掌握度。

## Decisions

1. **TeachingResource 和资源注册表继续是内容真源。** 新工件是只读治理投影，记录 `teachingResourceId`、`registryId`、resource revision/hash、规范节点、错因、动作、时长、先修、隐私和 launch target。替代方案是独立 JSON 内容目录，但会形成第二套资源 authority。
2. **登记键以规范节点与受控错因为主，不以题目 ID 为主。** 同一合格资源可以覆盖多个来源题，但每个适用关系必须显式、可审核。题目级复制会增加漂移和审核成本。
3. **动作使用版本化受控分类。** v1 至少区分阅读/解释、对比辨析、模型操作、自我解释和提取练习；资源必须给出可观察完成条件。仅打开页面不构成动作完成。
4. **投影绑定同一捕获修订。** Git 资源注册、数据库 TeachingResource 投影和图谱节点必须写入同一 capture revision；混合修订输出 `REFERENCE_DRIFT`。
5. **选择保持确定和失败关闭。** 先按 active、学生可见、节点、错因和版本过滤，再按时长与稳定 ID 排序；没有合格候选返回 `RESOURCE_UNAVAILABLE`。

## Risks / Trade-offs

- [现有资源相关但缺少可执行动作] → 不以相关性替代动作质量，保留缺口并制作最小必要内容。
- [一个资源覆盖过多错因而失真] → 要求逐关系审核 rationale，并在审计中报告过宽映射。
- [数据库和 Git 工件无法同修订捕获] → 先生成只读数据库 projection receipt，再运行 coverage audit；修订不一致时严格失败。

## Migration Plan

1. 审计现有 TeachingResource、registry 和节点映射，生成候选而非自动批准。
2. 人工确认资源—节点—错因—动作关系，补齐少量必要资源。
3. 发布 versioned 投影并接入编排和报告模式。
4. 完成负向测试后才启用严格覆盖；回滚时移除新投影 selector，保留既有单点资源路径。

## Open Questions

- 实现前确认现有资源完成事件能否承载 action id；若不能，新增字段必须保持旧事件可读。
