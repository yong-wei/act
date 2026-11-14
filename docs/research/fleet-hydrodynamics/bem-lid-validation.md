# 一阶求解盖板与输入一致性

原几何中的`lid.dat`由完整水线多边形和中心扇形三角形构成，用于封闭静水体积及检查执行器包络。邮轮、雪龙2号、天鲸的最大面元半径分别为106.572、39.954、44.585m。

Capytaine的内部自由面盖板用于消除非规则频率，采用向下法向，并位于自由面或其下方。`prepare_bem_lid.py`调用固定2.2.1版本的`generate_lid`，将最大面元半径限制为2m，自动核验高度、法向、有限值、投影重叠和水线内部范围。各船原静水封闭盖板与新`bem-lid.dat`分别保存哈希。[Capytaine盖板文档](https://capytaine.org/v2.2.1/user_manual/body.html#lid-mesh)

| 船型 | 湿面面元 | 内部盖板面元 | 盖板最大半径m | 水线内部面积覆盖 |
| --- | --- | --- | --- | --- |
| 邮轮 | 3892 | 1175 | 1.95983 | 93.545% |
| 雪龙2号 | 3316 | 248 | 1.95129 | 82.421% |
| 天鲸 | 3939 | 274 | 1.94538 | 83.704% |

面积覆盖由工具保留完全落在水线投影内部的网格单元计算，原始水线多边形继续用于静水计算。求解输入的湿面、质量、单一CG、惯量和恢复矩阵均保持冻结包的数据。

## 实际计算

每船先计算原盖板下129频率、24波向，再计算新盖板的七频率、三波向对照，随后计算新盖板的130频率、24波向。新增频率为.025rad/s，其余覆盖.05至4rad/s。邮轮和雪龙水深200m，天鲸20m，前进速度均为0。

下表保留生产器的1%互易/阻尼矩阵参考检查结果。表格列出未通过项数。

| 船型 | 原盖板129频率 | 新盖板七频率 | 新盖板130频率 |
| --- | --- | --- | --- |
| 邮轮 | 92 | 1 | 65 |
| 雪龙2号 | 44 | 0 | 16 |
| 天鲸 | 51 | 0 | 40 |

全部输出A/B、复激励和RAO均有限。邮轮新表的参考失败始于1.575rad/s。雪龙新表在2.5rad/s以内有一项2.475rad/s互易误差约1.0041%。天鲸.025rad/s的A/B互易误差约3.33%/3.89%，阻尼最小归一化特征值约−.000312，另有1.85至2.375rad/s互易误差约1.00%至1.35%。原始失败和高频负特征值继续保存在机读数组与报告中。

结果位于`cruise-first-order-validation/`、`ice-first-order-validation/`及`dredger-first-order-validation/`，case0/case1/case2分别对应三次计算。各目录保留原始数组、完整维度、工具/依赖/输入输出哈希、新盖板及其几何核验。当前精度为research-nominal，在线适用域、被动辐射拟合、含航速数据及峰值收敛继续验证。

## 长时任务输入冻结

`solve_first_order.py`在运行开始捕获生成器、湿面、盖板和几何文件的哈希。结果写入时复核输入一致性，变更进入`input_drift`、失败状态和非零退出码。输出始终记录运行开始的输入身份。

`verify_first_order_identity.py`实际执行两个小型BEM求解，在第二次求解后追加变更到输入网格文件。正常案例退出0，注入案例退出1并准确保留初始网格哈希。验证报告保存于`bem-input-identity-validation.json`。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/prepare_bem_lid.py --pack rust/control-engine/model-data/icebreaker-xuelong2/v1 --output /tmp/ice-bem-lid
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_first_order_identity.py --output /tmp/bem-input-identity-validation.json
```
