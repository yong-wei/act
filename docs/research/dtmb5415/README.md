# DTMB5415 基准转录证据（issue-2157 阶段 B 路径 3）

## 来源（可追溯）

- SIMAN 2014《US Navy Combatant – Geometry and conditions》
  https://simman2014.dk/ship-data/us-navy-combatant/geometry-and-conditions-us-navy-combatant/
  （取回 2026-11-09）。
- 桨敞水数据《5415 Propeller Openwater Data》（MARIN）：
  https://simman2014.dk/wp-content/uploads/2015/07/5415-Propeller-Openwater-Data.pdf
  （原件存本目录 `propeller_openwater.pdf`；KT/KQ 五阶多项式逐系数转录）。

## 交叉核对（issue 合同：不盲抄）

**原表实尺度排水体积列印 84244 m³ 为小数点丢失**，两项独立证据：

1. 模型值 0.189 m³（MARIN 35.480 缩尺）× 35.480³ = 8441 m³（三位有效
   数字精度内一致，偏差 0.2%）
2. Lpp·B·T·CB = 142×19.06×6.15×0.507 = 8439 m³

→ 按修正值 **8424.4 m³** 转录（`benchmark_dtmb5415.rs` 测试锁定两项
核对；原表疑点记录于代码注释与本文）。

## 转录范围（rust/control-engine/src/sixdof/benchmark_dtmb5415.rs）

- 几何/试验条件：Lpp/Lwl/Bwl/T/CB/CM/LCB/湿面积/GM=1.95/
  ixx/B=0.37/izz/Lpp=0.25/LCG/18·30kn（Fn 0.248/0.413）
- 桨：D=6.15、P/D(0.7R)=0.87、Ae/A0=0.58、5 叶、毂比 0.16、内旋；
  KT/KQ 五阶多项式（MARIN 系数）
- 舵：spade 30.8/15.4 m²、9°/s
- 推导量（分级）：排水质量 D 级（∇×1025）；iyy 标称 T 级（无公开值，
  取 izz 同量级）；ixx/izz 按 B 级试验条件回转半径推导

## 验证（5 用例）

体积双交叉核对 / 桨系桩值逐位 / 零推力 J=0.95 与 P/D=0.87 一致 /
设计点 η0(0.6-0.8)∈(0.5,0.8)（实算 0.62-0.68）/ 惯量回转半径恒等 /
Fn 与服务航速互核 <1%。

## 未转录（not_ready，显式边界）

- **操纵性 PMM/CMT 系统导数**：SIMAN 系统法数据另行发布，未在条件页；
  本模块不含任何虚构船体导数——入完整参数包待该数据转录后进行。
- 055 是教学代表船：DTMB5415 为公开数值验证船，两者不混同（issue 合同）。
