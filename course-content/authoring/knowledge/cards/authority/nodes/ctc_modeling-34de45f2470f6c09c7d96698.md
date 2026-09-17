---
node_id: ctc_modeling-34de45f2470f6c09c7d96698
authority_entity_id: "ctc:modeling-34de45f2470f6c09c7d96698"
name: "线性化"
name_en: "Linearization"
category: 程序性
knowledge_type: X
bloom_level: 理解
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-89fdf81e813cc601c6af86a77304875a683ffefc23dd9637df926d8cbecb4029.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-89fdf81e813cc601c6af86a77304875a683ffefc23dd9637df926d8cbecb4029.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-03a/previous/ctc_modeling-34de45f2470f6c09c7d96698.md"
asset_refs: []
---

## 首页

# 线性化 | Linearization

**一句话定义**：在选定工作点附近，用线性增量关系近似非线性系统的局部变化。

**核心直觉**：把曲线在工作点附近放大，局部形状可以由切线描述；放大范围变大，曲率的影响也会回来。

**关键公式**：
$$
\delta\dot{x}\approx -4\delta x+\delta u
$$

**学习目标**：能从平衡状态定义偏差，说明一阶近似删去了什么，并判断近似适用的状态范围与时间范围。

## 详情

### 完整解释

许多控制对象的方程包含平方、乘积或饱和等非线性项。直接研究原方程当然最准确，但它常常难以用统一的线性工具比较。线性化提供了一个局部视角：先选定一个工作状态，再只描述这个状态附近的小变化。这里的“线性”修饰的是增量模型的关系，原来的非线性对象仍然保留。

用一个无量纲的一阶系统说明这件事：
$$
\dot{x}=u-x^2.
$$
取常值输入 $u_0=4$，状态 $x_0=2$ 满足
$$
0=u_0-x_0^2=4-2^2.
$$
令 $x=x_0+\delta x$、$u=u_0+\delta u$。由于工作点是常数，$\dot{x}=\delta\dot{x}$。把偏差代回原方程，得到精确的增量关系
$$
\begin{aligned}
\delta\dot{x}
 &=4+\delta u-(2+\delta x)^2\\
 &=\delta u-4\delta x-\delta x^2.
\end{aligned}
$$
最后一项是偏差的二次影响。一阶线性化保留常数项和一次项，删去二次及更高阶项，于是
$$
\delta\dot{x}\approx -4\delta x+\delta u.
$$
这个方程描述的是“相对于 $x_0=2$ 和 $u_0=4$ 的变化”。它不是把 $u-x^2$ 改写成了一个对全部 $x,u$ 都成立的线性方程。偏差可以为正，也可以为负；近似的关键是偏差造成的高阶项相对于保留项足够小。

线性化的可信度同时受三个量影响。输入偏差决定系统被推离工作点的力度，状态偏差决定非线性项的实际大小，观察时段决定这种偏差是否会积累。即使输入看起来很小，若系统在一段时间内把状态推得很远，局部模型也会失去代表性。反过来，在很小的邻域内，线性模型能够准确表达变化的方向和主要时间尺度。

### 教学计算/推理例

从 $x_0=2$、$u_0=4$ 出发，施加增量阶跃 $\delta u=0.4$，并取 $\delta x(0)=0$。线性模型的完整求解从
$$
\delta\dot{x}+4\delta x=0.4
$$
开始。齐次解为 $C e^{-4t}$，常值特解为 $0.4/4=0.1$。由初始条件确定 $C=-0.1$，因此
$$
\delta x_{\mathrm{lin}}(t)=0.1\left(1-e^{-4t}\right).
$$
它从零开始，最终趋向增量 $0.1$；对应的状态趋向 $x=2.1$。若回到原方程，偏差还要满足
$$
\delta\dot{x}=0.4-4\delta x-\delta x^2,
$$
其中 $-\delta x^2$ 就是线性化忽略的局部曲率作用。这个例子给出的结论是：线性模型能回答工作点附近“变化得多快、朝哪个方向变化”，精度仍需结合状态偏离和观察时段检查。

### 适用条件与边界

线性化要求在选定点附近可以用一阶导数描述变化，并且变量的偏差定义清楚。工作点、输入偏置和初始偏差必须一并给出；把绝对量直接当作偏差会改变常数项。若状态离开局部邻域，二次项或更高阶项可能与一次项同量级，此时应重新选择工作点、缩小分析时段，或回到原非线性方程。这里的 $x$ 与时间均为无量纲教学变量，$x$ 允许取正值或负值。

### 常见误区

1. **误区**：得到一阶方程后，原系统就已经变成全局线性系统。**纠正**：一阶方程只描述所选工作点附近的增量行为，原方程仍包含 $x^2$。
2. **误区**：只要输入偏差很小，线性化就必然准确。**纠正**：还要检查输入造成的状态偏离以及所考察的时间区间。

### 自检

1. 为什么增量方程中没有常数 $4-2^2$？
2. 如果状态偏差逐渐变大，应该先检查哪个被忽略的项？

**核对要点**：$x_0=2,u_0=4$ 是平衡点，所以 $f(x_0,u_0)=0$；本例首先被忽略的是 $-\delta x^2$，它的大小随状态偏差平方增长。

### 关联节点

- **反馈线性化**（无向，关系：相关）
- **伪线性系统**（无向，关系：相关）
- **微变小信号线性化法**（入边，关系：属于）
- **如果小信号线性模型在平衡点附近有效且稳定，则存在一个包含该平衡点的区域，在该区域内非线性系统是稳定的。**（无向，关系：相关）
