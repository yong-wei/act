# 七船风载来源与物理接线

本轮保留完整源船模的默认静态布置，展开节点变换、蒙皮关节及GPU实例。GLB、清单、解码器及输出字节均冻结哈希。七船提取结果与实际Three.js GLTFLoader独立加载的顶点数、坐标总和和边界逐值一致，包含055舱门/旗帜蒙皮及集装箱实例。

常规船使用物理船形的纵横尺度、龙骨高度和当前CG，按实际平均水线裁切，再对正面和侧面三角投影作遮挡合并。重复和相互遮挡的表面只计一次面积。几何坐标取1e−7m精度，分块与静态布置的T级假设保留于机读证明。

| 船型 | 正面面积m² | 侧面面积m² |
| --- | --- | --- |
| 055 | 476.570 | 2254.697 |
| LNG | 1228.564 | 6333.222 |
| 集装箱船 | 2959.805 | 13676.250 |
| 邮轮 | 2547.956 | 15499.024 |
| 雪龙2号 | 633.255 | 1883.194 |
| 天鲸 | 493.713 | 1341.920 |

## 常规船

`vessel_wind.rs`按原论文式7/8/12/14至22及表3实现纵向/横向分量，式25/26确定压力作用点。80°至100°的两组回归用三次光滑权重衔接。原论文纵向回归系数的符号已保留，顺艉风可产生正向推力。v1恢复点按其声明版本读取风载模型。[原始论文](https://www.jstage.jst.go.jp/article/jjasnaoe/2/0/2_0_243/_article/-char/en)

全船模型最高点作为上层结构高度的T级输入。货载和可动设备采用源模型默认布置，外观货载集合保持固定，当前加载改变水线和CG。每种加载状态另算投影，气动标定及设备运动后的投影继续待验证。

真实NED风矢量通过完整姿态旋转到FRD，减去船体平动和压力点的角运动速度。横向风力的经验力臂、纵向风力的正面中心及相对CG位置共同形成六维载荷。当前帧记录实际加速度、质量阵方程分项及外力分项，风载直接进入实际RK积分。

## 平台

981采用默认源模型的遮挡合并投影，以5m网格分区的实际面积和面积中心计算构件阻力。空气密度1.225kg/m³、阻力系数1.2为T级输入，每个投影作用点使用本地点速度并通过r×F形成力矩。

解析箱体、倾斜水线、三重重叠表面和分区面积一阶矩共六组检查通过。最大投影形状差约6.5e−8m²，分区面积/一阶矩误差低于1e−10。平台零真风时的载荷功率与各作用点正耗散逐项闭合。

## 验证范围

七项Rust直接回归包括原论文Ro-Ro输入的端点、80/90/100°连续性、完整姿态与角速度、平台功率/力矩、无效参数加载门禁、实际RK消融和七船源数据的真实载荷对账。七船每个实际末拍的风分项与同一模型独立求值一致，外力分项之和与动力学右端一致。

本检查点完成风载参数和物理装配接口。新版本参数包、W1/W2常驻会话和正常页面继续由OpenSpec第0组跟踪，当前页面尚待迁移。

```bash
rtk proxy node docs/research/fleet-hydrodynamics/extract_hull_mesh.mjs --release public/assets/model-releases/type055-nanchang-101/v2.3.0 --all-nodes --output /tmp/055-wind-source
rtk proxy node docs/research/fleet-hydrodynamics/verify_mesh_extraction.mjs --release public/assets/model-releases/type055-nanchang-101/v2.3.0 --extraction /tmp/055-wind-source --output /tmp/055-wind-extraction-validation.json
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_wind_projections.py --source /tmp/055-wind-source --geometry rust/control-engine/model-data/destroyer-055/v4/geometry.json --source-sections rust/control-engine/model-data/destroyer-055/v4/full-source-sections.json --reference-draft-m 6.6 --output /tmp/055-wind
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_wind_projection.py --output /tmp/wind-analytic-validation.json
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_vessel_wind
```
