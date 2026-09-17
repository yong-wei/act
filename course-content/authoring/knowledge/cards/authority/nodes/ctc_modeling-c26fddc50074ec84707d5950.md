---
node_id: ctc_modeling-c26fddc50074ec84707d5950
authority_entity_id: "ctc:modeling-c26fddc50074ec84707d5950"
name: "常系数线性定常系统"
name_en: "Linear Time-Invariant System with Constant Coefficients"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f7a5d649bcd0bb155d799b3e6be3327134c34a322574e202a328068e7de9cd2a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f7a5d649bcd0bb155d799b3e6be3327134c34a322574e202a328068e7de9cd2a.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01b/previous/ctc_modeling-c26fddc50074ec84707d5950.md"
asset_refs: []
---

## 首页

# 常系数线性定常系统 | Linear Time-Invariant System with Constant Coefficients

**一句话定义**：由常数系数状态方程描述、同时满足线性叠加和时间平移不变性的系统。

**核心直觉**：常矩阵 $A$ 让同一组动态模态在不同时间都适用，但不替系统保证稳定。

**关键公式**：
$$
\dot{x}=Ax+Bu,\qquad y=Cx+Du\quad(A,B,C,D\ \text{constant})
$$

**学习目标**：识别线性定常假设，利用矩阵指数写出响应，并把稳定性与线性定常性分开判断。

---

## 详情

### 完整解释

“线性”要求叠加关系成立。在零初始条件下，若输入 $u_1,u_2$ 产生输出 $y_1,y_2$，则任意常数 $a,b$ 下，输入 $au_1+bu_2$ 应产生 $ay_1+by_2$；“定常”要求在零初始状态的输入输出比较中，输入整体延迟后，输出也只整体延迟，不因为发生在不同日时而改变规律。对连续时间状态模型，二者可由
$$
\dot{x}=Ax+Bu,\qquad y=Cx+Du
$$
表达，其中 $A,B,C,D$ 为常数矩阵。给定初始状态 $x(0)=x_0$，完整响应为
$$
x(t)=e^{At}x_0+\int_0^t e^{A(t-\tau)}Bu(\tau)\,\mathrm{d}\tau.
$$
非零初始状态也可以参与线性叠加，但必须把初始状态与输入一起组合为 $(ax_{01}+bx_{02},au_1+bu_2)$。若固定同一个非零初值而只叠加输入，自然响应会被重复计数，输入到完整输出的映射不满足上述零状态叠加式。例如 $\dot x=-x$、$x_0=1$，两个零输入试验各给出 $e^{-t}$；零输入之和仍给出 $e^{-t}$，并不是 $2e^{-t}$。

第一项是初始状态引起的自然响应，积分项是输入引起的受迫响应；矩阵指数函数把每个状态模态从 $0$ 推进到 $t$。若参数随时间变化，或者方程含有 $x^2$、$xu$ 等非线性项，就不能直接使用这套常系数线性结论。

线性定常只描述结构性质，不等于稳定。稳定性要看 $A$ 的特征值：左半平面特征值使自由响应衰减，右半平面特征值使某些初始状态发散。即使所有系数都是常数，也可能得到不稳定系统；把“定常”误读成“稳定”会把建模判断和性能判断混在一起。

### 教学计算/推理例

取标量模型 $\dot{x}=-x+2u$、$y=x$，即 $A=-1,B=2,C=1,D=0$。在 $x(0)=0$、单位阶跃 $u(t)=1$ 下，积分或直接解微分方程得到
$$
y(t)=2(1-e^{-t}).
$$
此时唯一特征值为 $-1$，自由响应衰减；在 $t=1$ 时 $y(1)=2(1-e^{-1})\approx1.2642$。若只把 $A$ 改为 $+1$，系统仍然线性、定常，但自由响应变成 $e^t x(0)$，会增长。

### 适用条件与边界

上述解要求连续时间、常数矩阵和给定初始状态。离散系统应使用差分方程或状态转移矩阵；时变系统不能把 $e^{At}$ 当作通用状态转移；非线性系统也只能在明确的工作点附近线性化后使用。

### 自检

1. 当 $A=+1$ 时，自由响应是衰减还是增长？为什么？
2. 线性定常是否自动意味着稳定？为什么？

**核对要点**：自由响应含 $e^t$，因此增长；不自动意味着稳定，稳定性由特征值位置而非“系数是否为常数”决定。

### 关联节点

- **矩阵指数函数**（关联）：由 $e^{At}$ 表示常系数状态的时间推进。
- **齐次状态方程拉氏变换解法**（关联）：在零输入时用变换域求自然响应。
