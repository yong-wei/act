- [x] 1.1 按设计决策扩展 Rust `mmg3dof` 契约：可选 surge/sway 推力与 yaw 力矩输入，缺省保持既有行为（方案 A；若不适配回落方案 B 并记录）
- [x] 1.2 组件接通 DP 四通道输出到被控对象（含倒车支持），移除硬编码 80 RPM 前进推力；遗留引擎 `engine-factory.ts` 同步修复
- [x] 1.3 DP 定位模式初始状态与 reset 前进速度改为 0
- [x] 1.4 风/流扰动滑杆接通物理与前馈（或移除无法接通的死控件）
- [x] 1.5 违规判定重构：定位精度告警与伦理违规解耦，加持续时间滞回，HUD 文案对齐语义
- [x] 1.6 从推进器推力派生功率遥测并显示（对齐钻井平台总功率口径）
- [x] 1.7 Rust 回归测试：默认参数与默认环境（含挖掘冲击）下 DP 定位 60 s 收敛到 tolerance 量级
- [x] 1.8 `wasm:build:control-engine` 重建；浏览器验收：`/simulations/dredger` 默认开局 60 s 定位误差收敛、功率显示、无持续违规告警
- [x] 1.9 typecheck、相关单元测试与 Rust 测试套件通过

## 度量与验证（方案 A 落地，未回落方案 B）

- **Rust 契约**：`mmg3dof` 新增可选 `surgeThrustKN`/`swayThrustKN`/`yawMomentKNm`（缺省 0 完全向后兼容，×1000 单点换算防 #1943 类双换算）；Rust 闭环回归测试（DP+挖掘扰动+mmg3dof 60s）通过；cargo test 全套（42+5+5+3+3+5+3）全绿。
- **组件**：DP 四通道接通（含倒车/反向推力），rpm 路径置零防双计推力；初速与 reset 归零；风/流滑杆接通定常环境力（流≈129kN@2m/s、风≈375kN@20m/s 量级，DP 前馈补偿）；定位精度告警与伦理红线解耦（0.1m 触发/0.05m 清除/持续 10s，HUD 改「定位精度告警」）；功率遥测 P=maxPower×(F/Fmax)^1.5 口径（20MW 装机分账）。
- **遗留引擎**：MMG3DOFEngine DP 分支同步修复（同四通道+滞回）；驱动链守卫以 AUTHORIZED_DRIVE_CHAIN_FILES 显式授权本 change 的 4 个文件（不污染 R6 清单）。
- **浏览器验收**（Playwright 探针，学生会话注入，默认 DP 开局 70s 实时）：位置误差 **0.000 m**（QA 报告原 89.9→302 m 发散）、总功率 0.1 MW 显示、无精度告警、无页面错误。
- **套件**：simulations 单测 268/268、drive-chain 守卫 5/5、typecheck EXIT=0、eslint 干净；WASM 已重建（identity.generated 同步）。
- **既有债务（基线等价，stash A/B 验证）**：tests/complex-simulations.spec.ts 的 dredger 用例在干净基线同样失败（无会话注入 + heading 名称过时，serial 级联 6 skip）——非本次引入，留待独立修复。
