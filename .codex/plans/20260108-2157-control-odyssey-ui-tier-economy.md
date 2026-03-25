# Control Odyssey UI/等级解锁/积分体系调整

## Goal
- 调整关卡选择与商店 UI，落地关卡等级解锁与新的积分/物价体系，并在结算页提供完整曲线详情。

## Scope
- In-scope: 关卡选择页滚动/按钮改版、商店积分展示、等级解锁持久化、积分与价格调整、结算详情曲线
- Out-of-scope: 其它模块功能变更

## Steps
1) 更新数据层：新增等级进度字段与积分公式，调整控制器售价
2) 更新 UI：关卡选择页滚动/配置并开始按钮/锁定态，商店积分展示与结算详情折叠
3) 更新遥测曲线共享与等级解锁逻辑
4) 运行 lint/test/build/test:integration

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 关卡选择页可滚动；“配置并开始”逻辑可用；等级解锁生效；积分与价格挑战性提升；结算详情可展开曲线
