# Tasks: issue-2156-p1

> 多阶段：阶段 A（本 change 内核模块 + 开关 + 种子 + 算例）；QTF/通气/剪切/估计器为阶段 B。

## A1. 波场模块

- [ ] A1.1 JONSWAP 谱（γ3.3/σ.07,.09/ω.2–2.5）+ 128 等能频率段 + 7 方向 cos² 归一 + Σa²/2=Hs²/16 再归一
- [ ] A1.2 色散关系（含水深 200/40/20m）与相位/轨道速度（同一波场）
- [ ] A1.3 种子派生（seed→波子流）与确定性（同 seed 同序列；关二阶不改波面）
- [ ] A1.4 算例：m0≈Hs²/16 统计、波面/力同相、V1/V2/V3 工况、二阶 not_ready 标注

## A2. 风模块

- [ ] A2.1 Fujiwara 2005 分量风载（CX/CY/CN/CK 系数 T 级多项式，水上投影）
- [ ] A2.2 相对风：真风 FROM 语义→NED→船体系−船体运动−ω×安装点；压力中心力矩（r×F）
- [ ] A2.3 阵风二维 OU（物理时钟 20Hz、τ10s、确定性子流）
- [ ] A2.4 开关语义算例：disabled=气动 0 且水动力阻尼保留；enabled+0 真风=航行相对气流≠0；W1/W2 工况

## A3. 传感器链

- [ ] A3.1 SensorChannel 框架：安装点量测→采样→白噪→偏置 OU（精确离散）→量化→时延队列→(t_sample, t_arrive, quality)
- [ ] A3.2 N1 九通道按表实现；N0（误差关、API 保留）/N2（×2）
- [ ] A3.3 F1–F4 故障注入（斜坡偏置/GNSS 缺失 quality≠0 填充/扭矩归零轴系续走/角度冻结）
- [ ] A3.4 算例：样本方差/偏置相关/时延队列深度、N0↔N1 不改其他流、噪声改变控制动作、F 缺测非 0

## A4. plant/runtime 集成

- [ ] A4.1 EnvironmentState（wind/wave/current + enabled 三开关）替换 T 级 EnvironmentField 调用点
- [ ] A4.2 C1/C2 恒定均匀流经相对来流（对水/对地输出）；不叠加同义流力（#2153 合同延续）
- [ ] A4.3 sixdof_runtime：disturbance→E1 映射 + EnvironmentState 序列化往返 + factorMask 升级
- [ ] A4.4 帧率/倍速/暂停复现算例（物理时钟驱动随机流）

## A5. 验证与交付

- [ ] A5.1 cargo 全量绿 + typecheck + wasm 构建
- [ ] A5.2 `openspec validate issue-2156-p1 --strict`
