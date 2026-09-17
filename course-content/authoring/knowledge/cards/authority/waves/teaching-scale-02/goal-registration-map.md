# 核心主题目标的最小注册路径

只读code-mapper核对当前工作树后确认：goal-groups.json仅是教学分组，没有运行时代码读取入口。已审卡片接入新主题目标，需要同步现有注册链，不可仅增加作者文件或客户端选项。

## 必需位置

1. src/features/personalization/path-planning/registered-goal-ids.ts：固定目标ID，供学习状态与证据查询过滤。
2. src/features/personalization/path-planning/goal-canonical-knowledge.ts：目标与当前canonical端点映射；决定知识路径及范围裁剪。
3. src/features/personalization/path-planning/internal/assemble-plan.ts：LearningGoal定义与注册包装，含K/A/Q目标、目标切片、资源组合、证据及终点策略。
4. src/features/personalization/path-planning/adaptive-path-goal-options-client.ts：客户端ID、标题、说明和终点文案，影响选择器与URL校验。

服务端adaptive-path-goal-options.ts从listLearningGoals投影，不必再增加一套服务端选项。当前12目标共用control-correction切片；复用已存在K/A/Q目标与图节点时，不需要新增数据库模型或插件。若确实需要新的教学目标语义，再核对对应KAQ catalog，不能为了显示卡片制造学习证据。

## 最小验证

- goal-canonical-knowledge.test.ts：目标与canonical映射。
- adaptive-path-goal-options.test.ts和adaptive-path-goal-options-client.test.ts：服务端/客户端选项一致。
- assemble-plan.test.ts中的注册catalog和动态objective-boundary检查。
- 对新目标运行真实planLearningPath，确认对应已审卡实际进入mainPath，并验证图谱及受保护资源页面。现有只覆盖少数固定场景的测试不能证明新主题可消费。

定位期间发现服务端选项测试仍断言9个目标，实际已有12个；已按当前已接受目录修正为12并进行针对性验证。后续新增目标时同步真实数量或相应明确定义的目录契约。

这些位置是后续逐主题接入的实现依据，不代表已把29个主题注册为学生目标。当前不引入外部authoring JSON加载器或新插件架构。
