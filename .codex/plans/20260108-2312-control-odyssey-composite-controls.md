# Control Odyssey Composite Controls

## Goal
- 完成控制商店升级体系、测速反馈/前馈复合控制、难度滑块与UI优化，并确保通道与积分逻辑一致

## Scope
- In-scope: 控制商店滚动与升级、控制器复合与参数范围、难度滑块与积分倍率、控制结构框图、中文图例与偏置显示
- Out-of-scope: 其他互动资源/课程模块调整

## Steps
1) 数据与后端支持：更新控制器类型、解锁/等级数据结构、商店/升级规则与server actions
2) 前端状态与UI：商店滚动与升级UI、关卡配置布局与难度滑块、控制框图与参数面板、中文标注与偏置显示
3) 控制逻辑：实现测速反馈/前馈复合控制、参数范围按等级扩展、难度倍率影响通道与积分
4) 测试与验收：运行 lint/test/build/test:integration，修复问题并总结变更

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 控制商店可滚动、支持升级与等级展示，参数范围按等级扩展
- 速度反馈/前馈可与任意PID组合，配置面板仅显示相关参数，框图高亮
- 难度滑块影响包络宽度与积分倍率并有提示
- 关键UI中文标注与偏置提示正确显示
- 测试全部通过（除已知警告）
