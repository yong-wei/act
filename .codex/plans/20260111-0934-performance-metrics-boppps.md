# Lesson 06 · 控制奥德赛·指标裁判席（BOPPPS）

## Goal
- 基于“6性能指标_控制效果评价”内容，按 lesson-13 课程组织形式新建 lesson-06，并实现完整互动组件与教学流程（BOPPPS），复用平台 AI/互动接口。

## Scope
- In-scope items
  - 解读 docs/courses/6性能指标_控制效果评价.pdf 的时域性能指标与评价要点
  - 复用 src/resources/interactive-learning/lesson-13 的课程组织结构与配置方式
  - 新建 lesson-06 互动组件、清单与课程页面
  - 接入课堂组件（Video/Poll/Objective/Assessment/AI Report）
  - 更新 docs/ProjectDescription.md
- Out-of-scope items
  - 重构其他课程或平台底层能力

## Component Plan (BOPPPS 映射)
- Bridge-in
  - 视频导入：裁判席开场（对比“快但超调/稳但慢”的判罚）
  - 投票：你认为“好控制”最重要的标准？
- Objective
  - 学习目标卡：时域指标、判分逻辑、指标权衡
- Pre-assessment
  - 互动小测「指标速判」：识别上升时间/峰值时间/调节时间/超调量/稳态误差
- Participatory
  - 知识卡「指标裁判手册」：指标定义 + 曲线标注 + 5%误差带
  - 仿真台「裁判席计分器」：可调阻尼比/响应速度，生成阶跃响应并计算指标/评分
  - AI 提示区：基于指标给出调参建议（规则化）
- Post-assessment
  - 参数提交评估：给定指标阈值完成评分（AssessmentProbe）
- Summary
  - AI 动态报告：本班达标率、指标短板与改进建议

## Steps
1) 解析 PDF 与 lesson-13 结构，梳理指标与交互需求
2) 设计 BOPPPS 流程与组件清单，定义页面结构与数据流
3) 实现 lesson-06 组件与页面集成（含 AI 入口与资源注册）
4) 更新 docs/ProjectDescription.md 并运行 lint/test/build/集成测试
5) 通过测试后提交并推送当前分支

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- lesson-06 页面与资源清单就绪，BOPPPS 流程可完整体验
- 覆盖 PDF 的核心时域性能指标定义与评价逻辑
- 测试通过，文档与提交记录更新完成
