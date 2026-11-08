# Design: issue-2148-p1

## 结构

纯 Rust 计算内核（`sixdof/student_model.rs`），WASM 可调。输入输出均为 JSON 兼容结构。

- `StudentModel`：模型族标识 + 结构 + 系数 + 工作点 + 训练/验证元数据 + 版本。
- `ComparisonMode::{A, B, C}`：三种比较模式的输入/输出契约。
- `identify_nomoto1 / identify_nomoto2 / identify_fopdt / identify_roll`：辨识入口（输入激励+响应信号，输出系数+残差）。
- `evaluate`：指标计算（输入预测+测量，输出 RMSE/FIT/超调/调节时间/残差分析）。
- `wrap_angle / unwrap_angles`：角度正确处理。

## 算法

输出误差最小二乘（OE）：ZOH 离散化推进模型，与实际输出差最小化系数。多初值（参数空间网格起点），有界约束（一阶 T∈[0.2,2000]s，二阶 ω∈[0.01,3]rad/s ζ∈[0.01,3]，时延 L∈[0,20]s 粗搜0.2s→细搜0.02s）。收敛到边界/病态/激励不足 → 返回「未能可靠识别」（不返回默认参数）。

## 不变量

- StudentModel 永不驱动物理状态
- C 模式理想侧不读物理侧误差信号
- FIT 可负、分母近零→NotApplicable（非 100）
- 无效数值（NaN/Inf）不归零计分
- 辨识失败返回显式错误状态
