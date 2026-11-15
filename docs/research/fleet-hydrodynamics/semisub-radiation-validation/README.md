# 981同源附加质量与六维被动辐射

semisub-981/v2在原v1船形、质量、CG、执行器和构件阻力上接入零速被动辐射。物理基准保持53095000kg、KG36.353925m和200m水深，拟合数据来自同一CG下的6896面一阶求解。频带为.025至2.5rad/s。

## 固定拟合与来源

FRD转换为[1,−1,−1,1,−1,−1]，以刚体对角惯性的平方根作合同变换。根据源几何对称性，联合拟合surge/pitch、sway/roll，另拟合heave及yaw。每块保留12对极点，残量和A_inf施加半正定约束。初始极点与阻尼保存在`../semisub-radiation-initialization.json`，350次初步迭代的状态与误差一并记录。

`fit_passive_radiation.py`采用半正定投影求残量和A_inf，再优化极点。四块分别经过718、824、611、1666次优化迭代收敛。权重为ω⁻¹/²，并在每块分别按A/B的整体范数归一化。原始矩阵、拟合矩阵和残量全部保存在参数包`radiation-fit-arrays.npz`，完整求解来源与失败检查保存在`radiation-fit-validation.json`。

| 通道组 | A相对L2误差 | B相对L2误差 | 加权A误差 | 加权B误差 |
| --- | --- | --- | --- | --- |
| surge/pitch | 6.5061% | 13.5296% | 4.3490% | 14.3751% |
| sway/roll | 5.0619% | 13.1779% | 3.5412% | 14.3004% |
| heave | 1.3719% | 9.4162% | 1.0072% | 8.5021% |
| yaw | 5.4130% | 11.1417% | 3.3096% | 10.7993% |

整体A/B相对L2误差为4.8240%/12.6433%，5%拟合参考目标尚有差距。当前模型等级为research-nominal，实船校准和含航速辐射实现继续验证。

## 能量与数值组装

分解后的52个非零振子使用104个状态。每个振子满足

\[
\dot x=z,\qquad
\dot z=b^T\nu_r-2\zeta\omega_n z-\omega_n^2x,\qquad
\tau=bz.
\]

储能E=(z²+ω_n²x²)/2，端口功ν_rᵀτ等于储能变化率与2ζω_nz²耗散之和。A_inf由六个质量因子的外积和得到，同一个矩阵进入总质量与C_A。恒定相对速度的预载状态使记忆载荷为零。

实际RK阶段计算相对速度记忆。均匀NED海流采用完整FRD投影，包含旋转坐标导数−ω×v_c，并进入相对惯性。海流导数经过独立四元数有限差分检验，实际船体的总质量、C_A、海流惯性和记忆分项共同对账。

完整刚体/辐射110维线性系统在120Hz和240Hz的RK4储能增益最大为1+约1.8e−15，连续能量对称部分的最大特征值约5.2e−15。实际船体五秒升沉衰减的最大相对储能增量约6.2e−10，末储能约初值97.4706%，时间步减半的位移/速度归一化差约2.0e−13/2.7e−13。

## 独立校核与运行

`native-frequency-response.csv`为Rust原生加载v2包后生成的100频率、六通道矩阵响应。与原半正定拟合数组的A/B相对差为2.17e−16/2.63e−16。另一途径采用SciPy对完整104维状态矩阵求逆，原生A/B相对差为1.76e−16/5.71e−16。数值组装误差和原始BEM拟合误差分别保留在`independent-validation.json`。

Rust九项直接和全量395项通过，实际参数包的海流恢复与完整未来保持一致。十五个真实WASM对象覆盖既有七船/加载状态和981 v2，暂停、120Hz/20Hz及完整未来字节对账通过。旧v1恢复点继续通过原始未来字节对账。WASM对象证明位于`../semisub-radiation-session-validation.json`。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/fit_passive_radiation.py --first-order-dirs /tmp/semisub-low /tmp/semisub-full --geometry rust/control-engine/model-data/semisub-981/v1/geometry.json --initialization docs/research/fleet-hydrodynamics/semisub-radiation-initialization.json --output /tmp/semisub-fit
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_coupled_radiation -- --nocapture
rtk proxy cargo run --manifest-path rust/control-engine/Cargo.toml --example validate_passive_radiation -- semisub-981 research-nominal-v2 docs/research/fleet-hydrodynamics/semisub-radiation-validation/frequencies.json /tmp/native-radiation.csv
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_passive_radiation.py --fit /tmp/semisub-fit --native-csv /tmp/native-radiation.csv --output /tmp/radiation-check.json
```

DP、32MW总预算、推力/射流约束、在线绕射和完整复数QTF以及正常页面继续由OpenSpec剩余任务实施。
