# AI Odyssey Control AI

## Goal
- 在控制奥德赛相关页面新增 20 积分 AI 接入能力与失败结算详情入口，并更新文档与测试。

## Scope
- In-scope items
- 关卡配置页 AI 建议入口（控制框图下、启动按钮上）。
- 失败结算页补齐“详情”查看仿真曲线。
- 失败/胜利阶段页 AI 接入（含仿真指标总结上下文）。
- 使用 env 中的大模型 API 进行调用。
- 更新 docs/ProjectDescription.md。
- Out-of-scope items
- 关卡数据模型结构变更或新字段设计。

## Steps
1) 新建分支并梳理现有控制奥德赛与 AI/积分相关实现与数据来源。
2) 实现 AI 调用与上下文拼装（关卡等级提示词 + 控制器配置 + 仿真指标摘要），接入积分扣减逻辑。
3) 页面改造：关卡配置页按钮、失败结算页详情、失败/胜利阶段页 AI 入口与交互。
4) 更新 docs/ProjectDescription.md 并运行 lint/test/build/integration；修复至通过后提交推送。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- AI 调用按 20 积分扣减且余额不足时禁用/提示。
- 关卡配置、胜利/失败阶段页均可调用 AI，且提示词包含所需上下文。
- 失败结算页新增详情按钮并展示仿真曲线。
- 文档更新、测试通过、提交并推送到新分支。
