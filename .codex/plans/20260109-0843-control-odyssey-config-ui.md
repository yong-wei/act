# Control Odyssey Config UI

## Goal
- 重整关卡配置面板布局、参数范围与控制结构展示，匹配新的控制器升级与复合控制要求

## Scope
- In-scope: 参数范围与默认值调整、配置面板布局重组、控制框图显示、参数滑块联动、文案更新
- Out-of-scope: 关卡逻辑/物理模型核心算法调整（除必要参数映射）

## Steps
1) 数据与默认参数：调整参数范围基准与默认值，更新范围计算逻辑
2) 配置面板布局：重组关卡配置 UI，加入扰动类型/难度滑块/控制模式布局
3) 控制结构图：新增风格化框图与高亮，底部仅展示相关参数与遥感曲线
4) 测试与验收：运行 lint/test/build/test:integration，修复问题并总结

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 参数初始范围为 0-0.1，等级倍增生效
- 配置面板按指定行列排布，缺失参数不显示，扰动类型可见
- 控制结构框图高亮正确，参数滑块仅显示相关项
- 遥感曲线与中文标注保留
- 全部测试通过（已知警告除外）
