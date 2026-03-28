# 资源库正式融入大纲与课程制作流程

状态: active
最后更新: 2026-03-28
摘要: 记录如何把 `course-content/resource-library/` 从“可参考资料”升级为课程重构与课程制作的正式候选输入源。重点保存资源角色划分、读取顺序、单元级评审单与产物级转写规则，避免后续再次把资源库当成松散附件或直接拼贴来源。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../../course-content/resource-library/integration-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/integration-framework.md)
- [../../.codex/skills/syllabus-refactor/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/syllabus-refactor/SKILL.md)
- [../../.codex/skills/lesson/SKILL.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/skills/lesson/SKILL.md)
- [../../docs/plans/2026-03-28-resource-library-skill-integration.md](/Users/YW/Documents/Site/act.just.edu.cn/docs/plans/2026-03-28-resource-library-skill-integration.md)

## 适用场景

- 课程总蓝图、模块骨架或单元边界讨论中，需要正式吸收 `resource-library` 资源
- 生成讲义、教案、互动页、多媒体前，需要判断哪些旧课件、思政案例、船舶案例值得接入
- 已经知道资源很多，但不希望课程退化成“见到什么就塞什么”的资料拼盘

## 资源角色固定口径

- `pptx/`：表达参考源，用于概念顺序、图示骨架、例题组织和可复用图
- `civics-cases/`：价值引导源，用于系统观念、工程责任、技术边界等专业嵌入点
- `ship-control-cases/`：工程场景源，用于船舶建模、分析、校正、边界和迁移实例
- 既有习题资源：训练校准源，用于校准训练强度和题型边界

## 标准读取顺序

### 大纲重构

1. 先读 `course-content/syllabus-refactor/` 当前蓝图与边界文稿
2. 再读 `course-content/resource-library/integration-framework.md`
3. 按需读索引：
   - `course-content/resource-library/pptx/README.md`
   - `course-content/resource-library/civics-cases/integration-points.md`
   - `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
   - `course-content/resource-library/ship-control-cases/indexes/section-map.md`
4. 只有候选资源通过边界审查后，才下钻到具体案例或提取包正文

### 课程制作

1. 先读单元边界：`module-skeletons.md`、`unit-design-details.md`、对应 `module*.md`
2. 再读 `course-content/resource-library/integration-framework.md`
3. 依据当前单元目标，选择性读取相关资源索引与正文
4. 形成资源采用单后，再写讲义、教案、互动页和媒体规格

## 必须先产出的两张单

### 1. 资源融入评审单

用于 `syllabus-refactor`。至少写明：

- 候选资源路径
- 资源类型
- 计划落点
- 采用方式：`改写吸收 / 直接复用图片 / 仅作灵感 / 排除`
- 采用级别：`必融入 / 可选融入 / 排除`
- 不采用理由

### 2. 本课资源采用单

用于 `lesson`。至少写明：

- 候选资源路径
- 资源类型
- 计划落点（导入 / 正文 / 例题 / 互动 / 总结 / 练习 / 媒体）
- 采用方式
- 采用级别
- 边界说明

## 产物级转写规则

- 讲义：吸收图示骨架、案例片段、例题组织，但必须重写成当前单元主线
- 教案：优先承接思政案例、船舶导入、误判点和课堂讨论任务
- 互动页：只把真正值得互动升级的比较、预测、验证和读图任务转成步骤
- 多媒体：可以复用原图、依据原图重绘或仅保留信息结构，但最终都要过正确性和版面复核

## 两条关键红线

1. 不要求每个单元都强行接入四类资源；没有合适资源时，应明确写“本轮不强行接入”。
2. 资源库不是成稿库；旧 `PPT` 页序、案例原文和船舶章节都不能直接拼接成新课正文。
