## Why

完整导入 ActKG Release 不表示其中所有对象都属于当前课程教学范围。ACT 需要一个独立、可审查的课程覆盖 Overlay，防止教材出现、资源绑定或模型建议自动激活知识对象。

## What Changes

- 新增 Git 管理的 CourseCoverage Overlay 作者态和确定性数据库投影。
- 仅允许 `formal_objective`、`necessary_prerequisite`、`explicit_extension` 三类课程角色激活 Canonical Object。
- 完整 Release 仍可浏览；未进入 Overlay 的对象不得参与推荐、KAQ、路径、评价或新学习事实。
- 资源出现、教材命中和模型建议只形成覆盖候选，不能自动发布。
- 首轮不建设教师在线编辑、数据库人工维护或回写作者态能力。
- 本变更依赖 `add-authoritative-knowledge-repository`，不切换生产权威。

## Capabilities

### New Capabilities

- `course-knowledge-coverage-overlay`: 定义课程使用范围、三类覆盖角色、Git 作者态和运行投影合同。

### Modified Capabilities

无。

## Impact

- 影响课程作者态结构、Overlay 校验与导入、数据库查询和覆盖审计。
- 为资源绑定、KAQ、路径和新事实提供课程准入边界。
