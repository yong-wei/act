# 风载与被动辐射参数版本

本检查点装配五个显式参数版本。完整船形、固定质量与设备布局取自各自的基础包，新增同源被动辐射和源船模风投影。

| 船型 | 版本 | 辐射状态数 | 原始BEM拟合A/B相对差 |
| --- | --- | --- | --- |
| 055 | research-nominal-v5 | 118 | 1.64% / 2.49% |
| 邮轮 | research-nominal-v2 | 120 | 2.80% / 6.66% |
| 雪龙2号 | research-nominal-v2 | 106 | 1.66% / 2.70% |
| 天鲸 | research-nominal-v2 | 116 | 1.92% / 1.19% |
| 981 | research-nominal-v3 | 104 | 4.82% / 12.64% |

原始BEM数组的离散残差与互易检查保存在源证明中，拟合采用PSD约束。邮轮和981的部分拟合误差超过5%参考目标，当前精度为research-nominal。含航速辐射标定与在线波浪域继续验证。

## 独立频域对照

每船输出100频率、六乘六完整A/B矩阵。原生Rust因子化振子响应分别与冻结的原PSD拟合数组、完整SciPy状态空间矩阵求逆比较。相对误差约1e−16，源BEM拟合残差另外记录于同一报告。

各船的`*-native-validation.json`保存参数哈希与CSV字节身份，`*-independent-validation.json`保存四项独立数值差及实际阶数。源数据、拟合误差和输入/输出哈希位于相应模型包内的`radiation-fit-*`文件。

## 实际会话

五船分别运行P0、W1、W2，共十五个真实WASM会话。原生频域入口与WASM会话的参数哈希一致，120Hz物理和20Hz控制、暂停、测量反馈及完整未来状态通过。W1/W2保留真实六维风分项、OU随机过程和实际姿态，恢复后未来字节一致。

两项新船队回归和相关Rust共25项通过，包含各新包的W1/W2状态恢复、旧加载状态及风/辐射数值回归。旧v1恢复点的完整未来字节核验通过。本范围为数值会话，正常页面继续按OpenSpec第0组接线。

```bash
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_fitted_fleet --test sixdof_vessel_wind --test sixdof_coupled_radiation --test sixdof_loading_packs
rtk proxy cargo run --release --manifest-path rust/control-engine/Cargo.toml --example validate_passive_radiation -- destroyer-055 research-nominal-v5 docs/research/fleet-hydrodynamics/semisub-radiation-validation/frequencies.json /tmp/055-response.csv
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_passive_radiation.py --fit rust/control-engine/model-data/destroyer-055/v5 --native-csv /tmp/055-response.csv --output /tmp/055-independent-validation.json
rtk proxy node docs/research/fleet-hydrodynamics/validate_native_session.mjs --vessel destroyer-055 --version research-nominal-v5 --environment W1 --output /tmp/055-w1-validation.json
```
