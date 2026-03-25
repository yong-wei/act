# Unified Lesson Framework

## Goal
- 统一课程框架规范并整改 Lesson 02/06/13，使其符合 DB BOPPPS 教案 + TeachingResource/registry 的标准流程。

## Scope
- In-scope: 更新 docs/Unified_Lesson_Framework.md、docs/ProjectDescription.md、AGENTS.md；新增/修订预置教案与资源注册；调整 Lesson 02/06/13 组件契约与埋点；完善课堂播放器对 overrideConfig 的支持；必要的 seed/数据同步脚本更新。
- Out-of-scope: 新增课次内容开发、数据库迁移与生产数据修复、UI 设计大改。

## Steps
1) 更新文档与规范：统一框架定义、数据流、组件契约、资源注册、事件与AI上下文标准。
2) 统一课堂引擎与资源协议：支持 LessonItem.overrideConfig 合并；补齐 preset/seed 资源条目与 registry 关联。
3) 整改 Lesson 02/06/13 组件：适配 BaseWidgetProps、埋点与完成回调；补齐 preset 教案与配置。
4) 校验与测试：执行 lint/test/build/integration（按项目要求），记录结果与风险。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 规范文档与项目说明更新完成。
- Lesson 02/06/13 可通过 preset + registry + LessonPlan 播放，组件契约统一且事件可采集。
- overrideConfig 在课堂播放器链路中生效。
- 所有要求测试执行并记录结果。
