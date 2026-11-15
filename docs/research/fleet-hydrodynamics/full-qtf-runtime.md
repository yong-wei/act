# 完整复数差频表读取与核验

运行数据包含两个波向、六个载荷通道及频率下三角形，复数以交错实部/虚部的IEEE f32小端值保存。metadata.json固定频率、角度、龙骨吃水、平均前进速度、水深、湿面、来源、单位和数据身份。转换及独立核验脚本校核SHA-256，Rust读取器核验长度、有限值、FNV数据标识和规范化完整元数据身份。

NEMOH采用exp(−iωt)，输入波向在艏向—左舷—向上坐标系中定义。运行器把NED顺时针相对波向转入源坐标，按六通道符号转换到FRD。频率上三角通过交换波向并取共轭恢复，频率和两个方向分别线性插值。方向扩展对两个波向共同旋转180°，并应用对应力/力矩旋转。原始方向覆盖和数值对称性残差保存在清单中。[NEMOH约定](https://lheea.gitlab.io/Nemoh/description.html#expression-of-physical-quantities) [差频输出](https://lheea.gitlab.io/Nemoh/input-output.html#quadratic-transfer-function)

Kurnia与Ducrozet式(10)、(12)给出的双波交叉项为Re(Qᵢⱼaᵢaⱼexp(−iΔωt))。完整有序双重和的系数为1/2，单个波分量的均值为Qᵢᵢaᵢ²/2。运行器从完整有序实二次型预组合频率三角形，其中非对角的(Qᵢⱼ+conj(Qⱼᵢ))/2恰好表示两个有序项的合计。源表中的复数及求解残差独立保存。[原始论文第5页](https://zenodo.org/records/7418379)

七项直接回归覆盖源数组四维插值、完整有序双重和、双波复相位、单波均值、共轭/坐标转换、频率/角域边界、平均航速/吃水/水深/湿面以及损坏数据与元数据身份。SciPy独立实现重建完整频率矩阵，实际读取六通道NEMOH数据进行对照。

完整93频率、17波向的60634512字节运行数据已在Rust Release入口读取。896个同源波分量的120次实际载荷，与SciPy完整有序双重和对照，六通道相对L2差约3.3e−14至6.5e−14。原始波分量、120行六通道轨迹、数据清单与独立误差报告位于semisub-qtf-validation。单次平均约0.58ms，测量包含数值调用及轨迹数字格式化。该记录的模型为零平均前进速度、19m吃水、200m水深和冻结平均艏向0.1rad。

当前完成Rust离线读取和载荷合成。完整数据的版本化资产发布、WASM对象挂表、船体运行时的平均姿态/作用坐标处理及981课程场景接线继续由OpenSpec任务0.14管理。来源参数精度保持research-nominal，网格收敛与公开船型基准误差继续按原证明记录。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/prepare_qtf_runtime.py --archive /tmp/semisub-qtf-full-complex.npz --validation-report docs/research/fleet-hydrodynamics/semisub-qtf-validation/validation.json --case-dir /tmp/semisub-qtf-result --geometry /tmp/semisub-mesh/geometry.json --output /tmp/semisub-qtf-runtime
rtk proxy cargo run --release --manifest-path rust/control-engine/Cargo.toml --example validate_full_qtf -- /tmp/semisub-qtf-runtime/metadata.json /tmp/semisub-qtf-runtime/qtf-f32le.bin /tmp/semisub-native.json
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_full_qtf.py --runtime-dir /tmp/semisub-qtf-runtime --native-runtime-report /tmp/semisub-native.json --output /tmp/semisub-native-independent.json
```
