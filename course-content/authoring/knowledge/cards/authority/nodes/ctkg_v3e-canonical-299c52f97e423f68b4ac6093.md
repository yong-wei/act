---
node_id: ctkg_v3e-canonical-299c52f97e423f68b4ac6093
authority_entity_id: "ctkg:v3e-canonical-299c52f97e423f68b4ac6093"
name: "稳态性能"
name_en: "Steady-State Performance"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b40da3df73a484db5c2c82affebb727a3b885e4f401ad9694c9c05ec8401fbd6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b40da3df73a484db5c2c82affebb727a3b885e4f401ad9694c9c05ec8401fbd6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01c/previous/ctkg_v3e-canonical-299c52f97e423f68b4ac6093.md"
asset_refs: []
---

## 首页

# 稳态性能 | Steady-State Performance

**一句话定义**：稳态性能描述过渡过程衰减后，系统对参考、扰动和噪声的长期精度。

**核心直觉**：先问“最后剩多少偏差”，再分别评价“到达那里有多快、是否振荡”。

**关键公式**：
$$
e_{t,ss}=\lim_{t\to\infty}[r(t)-y(t)]
$$

**学习目标**：写清误差通道、输入类型和稳定性，并区分测量误差与物理跟踪误差。

**关联**：动态性能指标 · 动态性能

---

## 详情

### 完整解释

稳态性能关心的是长期结果，而不是响应曲线经过了怎样的瞬态。对单位阶跃、斜坡或其他输入，要先说明参考输入、扰动或测量噪声从哪里进入，再说明比较的是哪一个误差。对单位负反馈，比较器测量输出就是实际输出，误差可写为 $e_m=e_t=r-y$；但一般测量通路 $H(s)$ 下，控制器看到的是 $e_m=r-Hy$，物理跟踪误差仍是 $e_t=r-y$。

以参考输入为例，零初始条件下的信号方程为
$$
y=CGe_m,\qquad e_m=r-Hy,
$$
从而
$$
\frac{Y}{R}=\frac{CG}{1+CGH},\qquad \frac{E_m}{R}=\frac{1}{1+CGH},\qquad \frac{E_t}{R}=1-\frac{CG}{1+CGH}.
$$
只有 $H=1$ 时，最后一个误差传递函数才与测量误差传递函数相同。对给定信号，若闭环稳定且 $sE(s)$ 的极点条件成立，才可以用终值定理报告稳态值；不稳定或持续振荡的系统不应写成一个有限的“稳态误差”。

稳态性能还依赖输入阶次。单位阶跃的参考值最终为常数，位置误差系数控制它的残差；单位斜坡持续增长，速度误差系数控制误差是否收敛为常数；更高阶输入需要更多低频积分能力。扰动和测量噪声的结果必须按注入位置重写：若对象输入处有扰动 $D$，则 $Y/D=G/(1+CGH)$；若测量端叠加噪声 $N$，则 $Y/N=-CG/(1+CGH)$。同一个闭环可能对参考跟踪很好，却对某一位置的扰动抑制较差。

### 教学计算/推理例

先看单位负反馈的稳定闭环
$$
\Phi(s)=\frac{2}{s+3},\qquad R(s)=\frac1s.
$$
零初始条件下 $Y(s)=2/[s(s+3)]$，反变换为 $y(t)=\tfrac23(1-e^{-3t})$。闭环极点为 $-3$，因此 $y_{ss}=2/3$，单位阶跃的物理跟踪误差为 $e_{t,ss}=1/3$。这个数值只说明长期精度，不说明超调、上升时间或调节时间。

再固定同样的 $C(s)=3$、$G(s)=2/(s+1)$，但令测量通路 $H(s)=2$。闭环分母为 $s+13$，单位阶跃时
$$
\frac{Y}{R}=\frac{6}{s+13},\qquad e_{m,ss}=1-\frac{12}{13}=\frac1{13},\qquad e_{t,ss}=1-\frac6{13}=\frac7{13}.
$$
比较器几乎“看到”目标，并不表示实际输出已经跟上目标；$H$ 的量纲和直流增益必须纳入解释。

### 适用条件与边界

稳态性能计算假设线性定常模型、已声明的零初始条件和负反馈符号。先核对闭环极点，再对选定的 $E_m$ 或 $E_t$ 检查终值条件。饱和、死区、摩擦和时变工况可能使线性稳态结论只在某个工作区间内成立。动态性能指标与稳态性能是互补维度，不能用一个数字代替另一个。

### 常见误区

1. **误区**：单位阶跃误差为零，就说系统没有超调且响应很快。**纠正**：零静差只描述终值；超调、上升时间和调节时间属于动态性能，须单独检查。
2. **误区**：非单位测量通路中 $e_m$ 很小，就等于物理跟踪误差 $e_t$ 很小。**纠正**：$e_m=r-Hy$，而 $e_t=r-y$；$H\ne1$ 时必须分别计算两个量。

### 自检

1. $\Phi(s)=2/(s+3)$ 对单位阶跃的稳态跟踪误差是多少？
2. 当 $H=2$ 时，为什么测量误差与物理跟踪误差可能差别很大？

**核对要点**：闭环极点为 $-3$，输出终值为 $2/3$，所以误差为 $1/3$；测量误差是 $r-2y$，物理跟踪误差是 $r-y$，两者的反馈比例不同。

### 关联节点

- **动态性能指标**（无序关联）：与稳态性能并列的响应评价维度。
- **动态性能**（无序关联）：描述响应过程而非最终精度的关联概念。
