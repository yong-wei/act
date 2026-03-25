# Control Odyssey 功能开发

## Goal
- 落实关卡分级与控制商店设计，完成关卡配置/商店/引擎适配与数据存储，并修复相关游戏体验问题。

## Scope
- In-scope: level-data 新结构与随机信号生成、关卡等级选择、控制商店购买与控制器可用性、引擎/画面/距离/扰动/延时适配、排行榜去重与积分累积、文档更新与测试
- Out-of-scope: 其它模块功能调整

## Steps
1) 数据与状态层更新：完善 level-data 结构、引入关卡等级/随机信号生成策略，更新 store 状态，修改 Prisma schema 并补齐服务端动作（积分/解锁/排行榜去重）。
2) UI 流程更新：关卡选择页增加商店入口与积分展示、配置页加入等级/控制器选择并按解锁过滤，确保进入游戏后不再显示配置面板。
3) 引擎与渲染适配：LevelGenerator 依据参考信号生成通道与包络，GameCanvas 使用等级配置并渲染暗流扰动，PhysicsEngine 加入纯延时队列与扰动叠加，确保重启与初始场景一致。
4) 文档与质量验证：更新 docs/ProjectDescription.md，并运行 lint/test/build/test:integration。

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 关卡等级、商店、积分与控制器解锁流程可用；关卡起始/重启一致；终点即时结算；文档与测试完成。
