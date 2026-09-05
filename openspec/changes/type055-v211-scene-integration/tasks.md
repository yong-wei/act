# Tasks

## 1. 接收 v2.1.1 发布包

- [ ] 1.1 接收脚本 `RELEASES` 新增 `2.1.1` 条目（expectedManifestSha `24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430`，源 .blend 同接受版，validation 接受 `PASS`/`PASS_WITH_BUDGET_WARNING`）；补充失败优先测试：manifest/角色文件哈希漂移、部分接收均拒绝。
- [ ] 1.2 执行接收：`public/assets/model-releases/type055-nanchang-101/v2.1.1/` 原子入位，生成 `artifacts/model-releases/type055-nanchang-101-v2.1.1/receipt.json`，复制前后字节一致。
- [ ] 1.3 模型包描述符登记 v2.1.1：七角色 SHA-256/字节数、接口合同（15 主舰 clip、8 demo clip、VLS 112、HQ-10 24、两处贴花）、`matchActivatedType055Package` 覆盖 2.1.1。

## 2. 垂向锚定与波场统一

- [ ] 2.1 失败优先测试：版本化模型声明 `designWaterlineY` 时，模型水线锚定到波面参考（误差 <0.05m），不再依赖 bbox 底部=龙骨假设；无声明旧模型定位行为逐位等价。
- [ ] 2.2 描述符新增 `verticalAnchor.designWaterlineY`（type055=6.6）；`DestroyerModelScene` 按声明水线定位，旧路径走 bbox 推导。
- [ ] 2.3 失败优先测试：船体采样点处波面高度与共享 Gerstner CPU 采样（含基准 -1m）一致，船随可见波浪起伏。
- [ ] 2.4 `SimulationEngine` 五点波浪采样从本地正弦 `getWaveHeight` 切换到共享 Gerstner CPU 采样；heave/pitch/roll 的 lerp 平滑与推导不变。

## 3. 双桨航迹

- [ ] 3.1 失败优先测试：声明 propulsor 节点时逐帧锚点等于节点世界位置（含 basis yaw 与船体位姿）；左右桨各产生独立尾迹。
- [ ] 3.2 描述符声明 `propulsors`（`PROP_PORT`/`PROP_STARBOARD`）；尾迹 rig 按声明每桨挂载一条 `WakeTrail`，节点解析失败 fail closed 到 profile 单航迹。
- [ ] 3.3 旧链模型（无声明）保持 `wakeAnchors` 单航迹行为回归通过。

## 4. 声明式动画绑定（L0）

- [ ] 4.1 失败优先测试：按描述符 `semanticBindings` 解析节点与 clip；缺失节点/clip 时该绑定 fail closed，其余绑定与仿真不受影响。
- [ ] 4.2 描述符新增 `semanticBindings`（螺旋桨 clip-loop timeScale↔航速、舵角 procedural ±30°、国旗/雷达 clip-loop、天线 procedural 倾角↔航速）；实现绑定装配模块（mixer + 程序化驱动），挂载在版本化模型路径。
- [ ] 4.3 遥测等价回归：同输入下数值状态与控制输出与绑定前一致；驱动链 diff 无语义变化。

## 5. 彩蛋分层（L1/L2）

- [ ] 5.1 失败优先测试：未达成 successCriteria 时无武器巡检与演示请求；达成后 L1 巡检循环启动且首屏请求账本不含 demo GLB。
- [ ] 5.2 L1：达成后主舰武器 clip（主炮/CIWS/HQ-10/机库门）循环巡检，全部来自主舰 GLB。
- [ ] 5.3 L2：每次达成随机选取一条 weapon-demo clip 播放一次，demo GLB 按需加载；再次达成重新随机。

## 6. 生产切换与视觉验收

- [ ] 6.1 `versioned-defaults.ts` 激活指针切到 2.1.1；v2.1.0 降级为有序回退；默认路径请求账本只含当前档位 ship LOD。
- [ ] 6.2 浏览器视觉验收：QA 页与 destroyer 场景三档整舰可见；水线以下防锈漆红色可见且水线位置正确（灰红分界贴合波面）；双桨各一条航迹；桨转/舵随动/旗飘扬/雷达旋转/天线倾角可见；达成后 L1/L2 触发可见；截图矩阵留证。
- [ ] 6.3 回退路径视觉验收：v2.1.1 校验失败时 v2.1.0/旧链可见；`npm run typecheck` 与受影响测试套件通过，记录 exact-current-HEAD 证据。
