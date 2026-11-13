# 981零速完整复数差频数组

冻结输入为200m水深、688个湿面面元和96个水线盖板。NEMOH把z=0盖板用于不规则频率处理，边界激励及载荷积分显式排除这些面元。源码与二进制修订、六阶段退出码、耗时及哈希位于validation.json。

实际求解完成17×17波向对、93个基础频率的7579314行六通道下三角数据。QTFsolver耗时10431秒，输出文本约872MB。完整复数压缩数组57169863字节，按清单哈希保存在独立数据文件中，后续需要接入版本化资产发布与在线读取。comparison-arrays.npz保留八个代表频率的全部方向对和六通道原始复数。

差频输出包含正负实部及复相位。对角非负的旧Newman接口不能直接承载这组数据。均频率方向对Hermitian相对残差约2.5e−8至3.2e−7，共同180°旋转对照约7.6e−6至1.1e−5。当前±30°七方向波场的方向对具有几何覆盖，任意24×24方向对中仍有98对缺失。角域扩展需保留实测对称性误差及六通道旋转符号。

原始分项以三位小数写入弧度波向，后处理转成角度使显示坐标最多偏移约0.03°。导出器核验该舍入关系，并保留冻结输入与报告坐标。系数保持原始复数，不按显示坐标重新求解或修正符号。

本组仍为research-nominal，缺少完整自由面/渐近贡献、含航速差频、该QTF的网格/响应峰收敛和独立船型标定。validation.json分别记录已计算范围和未完成项。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/export_semisub_qtf.py --case-dir /tmp/semisub-qtf-result --output docs/research/fleet-hydrodynamics/semisub-qtf-validation --full-array /tmp/semisub-qtf-full-complex.npz
```
