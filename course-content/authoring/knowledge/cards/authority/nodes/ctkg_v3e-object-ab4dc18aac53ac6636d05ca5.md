---
node_id: ctkg_v3e-object-ab4dc18aac53ac6636d05ca5
authority_entity_id: "ctkg:v3e-object-ab4dc18aac53ac6636d05ca5"
name: "全状态反馈设计步骤"
name_en: "Full-State Feedback Design"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c624143d47f24c9d8374a994b953107a789fb79e89452ca0d0b1f10a8301dee9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c624143d47f24c9d8374a994b953107a789fb79e89452ca0d0b1f10a8301dee9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01h/previous/ctkg_v3e-object-ab4dc18aac53ac6636d05ca5.md"
asset_refs: []
---

## 首页

# 全状态反馈设计步骤 | Full-State Feedback Design

**一句话定义**：在全部状态可用于反馈的假设下，选择增益矩阵使闭环状态动态满足目标极点与约束。

**核心直觉**：同时利用位置、速度等状态，直接改变系统内部动态，而不只比较一个输出误差。

**关键公式**：
$$u=-Kx+Nr.$$

**学习目标**：依次检查状态可用性、可控性、目标极点、增益、参考标定和控制量约束。

---

## 详情

### 完整解释

对连续时间线性模型 $\dot x=Ax+Bu$，代入负反馈得到 $\dot x=(A-BK)x+BNr$。首先确认状态、输入、输出的定义与单位，再检查可控性。完全可控允许任意配置闭环极点；仅可稳定则足以寻求稳定反馈，但未必能任意移动全部模式。不同教材若采用正号反馈，增益符号也会随之变化，不能脱离控制律照抄矩阵。

接着根据性能和执行器能力选取目标极点、求 $K$，然后将结果代回 $A-BK$ 核对特征值。若任务是调节到原点，只需考虑 $r=0$；若要跟踪常值参考，还需设计参考输入系数 $N$ 或其他跟踪结构。状态反馈极点稳定本身不保证单位静态跟踪增益，也不自动消除模型误差和外扰。

### 教学计算/推理例

用归一化位置—速度模型
$$
A=\begin{bmatrix}0&1\\0&0\end{bmatrix},\quad B=\begin{bmatrix}0\\1\end{bmatrix},\quad C=\begin{bmatrix}1&0\end{bmatrix}.
$$
可控矩阵 $[B,AB]$ 的秩为2。取目标极点 $-2,-3$，目标多项式是 $s^2+5s+6$。令 $K=[k_1,k_2]$，则 $A-BK$ 的特征多项式为 $s^2+k_2s+k_1$，得到 $K=[6,5]$。

对准确名义模型取 $N=6$，参考到位置输出的闭环为 $6/(s^2+5s+6)$，单位阶跃终值为1。零初态响应是 $y=1-3e^{-2t}+2e^{-3t}$，在 $t=\ln2$ 时为0.5。若只写 $u=-Kx+r$，即 $N=1$，同一参考的终值就只有 $1/6$，尽管极点完全相同。

检查控制量同样必要：调节任务中若 $x(0)=[1,0]^\mathsf T$，初始控制为−6。若设备只允许幅值4，这个理想线性设计就不能直接实现，必须重新选择极点、限制参考或处理约束。过快的目标极点可能提高控制峰值与测量噪声敏感性。

### 常见误区与边界

1. **误区**：所有状态都能直接从传感器读出。**纠正**：必须核实可测性和采样条件，缺失状态通常需要观测器。
2. **误区**：求出K就完成设计。**纠正**：还需核验极点、参考标定、模型偏差、初值范围和执行器约束。

### 自检

1. 本例用 $N=1$ 时，参考单位阶跃的终值是多少？
2. 若状态不能全部测量，能否直接用真实 $x$ 实现控制律？

**核对要点**：$1/6$；不能，需要额外状态估计或其他可实现结构，并重新验证闭环。

### 关联节点

- **全状态反馈**（适用对象）：本卡给出从模型到增益与约束核验的步骤。
- **状态空间分步设计法**（无向关联）：将反馈增益设计与状态估计、跟踪和实现分开处理。
- **分离原理**（无向关联）：为随后组合状态反馈与观测器提供条件性的稳定性依据。
