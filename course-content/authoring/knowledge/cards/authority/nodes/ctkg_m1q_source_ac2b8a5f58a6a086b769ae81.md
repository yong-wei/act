---
node_id: ctkg_m1q_source_ac2b8a5f58a6a086b769ae81
authority_entity_id: "ctkg:m1q:source:ac2b8a5f58a6a086b769ae81"
name: "泛函"
name_en: "Functional"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-53f76a79a6a5f317296c9bcbcea2f31433f02ad75f260fc2c0a952e711c5c630.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-53f76a79a6a5f317296c9bcbcea2f31433f02ad75f260fc2c0a952e711c5c630.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-06a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 泛函 | Functional

一句话定义：泛函以一整条函数或轨迹为输入，并输出一个标量，常用于评价控制过程的总体表现。

- 泛函评价完整过程，不只评价一个时间点。
- 状态与输入通过动态方程关联。
- 同样的末端状态可以对应不同的泛函值。

---
## 详情
### 完整解释

普通函数可以把某一时刻的状态和输入映射为一个数，例如 $L(x,u)=x^2+u^2$。把这个量沿整个过程积分后，得到的J依赖整条控制函数及其产生的状态轨迹，因此称为泛函。符号J[u]用于突出输入对象是函数；它不是把一个时刻的u代入后即可算出的普通数值表达式。

评价泛函前必须规定函数的允许范围以及积分是否存在。若动态模型和初值固定，选择u便决定x，此时可把代价写成只依赖u的形式；若状态也列为优化变量，就必须同时保留动态约束，不能把x与u当作互不相关的曲线随意选择。

### 教学计算/推理例

取 $\dot x=u$、$x(0)=0$，区间[0,1]，末端要求 $x(1)=1$。允许实值平方可积控制，用输入平方积分评价代价：

$$
J[u]=\int_0^1u(t)^2\,dt.
$$

第一条控制函数为 $u_1(t)=1$，对应状态 $x_1(t)=t$，代价 $J[u_1]=1$。第二条为 $u_2(t)=2t$，对应状态 $x_2(t)=t^2$，代价为

$$
J[u_2]=\int_0^1 4t^2\,dt=\frac43.
$$

两条轨迹均从0到1，但泛函值不同。因此仅看初末状态不能恢复这个过程代价。相反，如果只采用末端平方误差，两者误差都为零，评价结果又会相同。判断差异来自指标定义，而不是轨迹名称或绘图形式。

还可以构造连续的候选族 $u_\varepsilon(t)=1+\varepsilon(1-2t)$。因为扰动积分为零，每个实数参数都保持输入积分为1，满足末端条件。直接积分得到

$$
J[u_\varepsilon]=1+\frac{\varepsilon^2}{3}.
$$

参数为零时这一族的代价最小。但若想进一步证明u=1对全部可行控制都最优，还需对整个允许函数集合论证，例如使用柯西不等式。只在一个参数族内搜索，不能自动覆盖全部函数。

### 从函数变化理解泛函变化

泛函的变化研究“整条曲线略微改变后，评价值怎样改变”。上述参数族给出了具体方式：固定扰动形状，改变其幅度，再把泛函变成关于参数的一元函数。变分法正是利用这类可行扰动建立必要条件，但还要核对扰动是否保持端点和其他约束。

本例的线性项消失，是因为扰动积分为零；平方项非负反映了输入平方代价的凸性。若换成别的指标，变化式和最优点可能改变，不能只凭泛函符号J就沿用同一结果。

### 适用条件与边界

在连续时间中，数值计算通常把轨迹采样后加权求和近似积分。步长、积分权重及函数规则会影响计算误差，直接把样本值相加通常不等于原积分。离散时间若本来就定义累加成本，则应遵循该离散指标，不把两种定义混为一谈。

输入平方积分有限意味着这里选用的能量型指标有意义，但它并不保证每个时刻的输入都小于某个硬上限。需要幅值限制时，应把它写入可行集合。评价指标与允许约束分别承担不同作用。

### 常见误区

1. 将J[u]理解为只计算末端输入值。
2. 状态和输入分别挑选，却不检查动态方程。
3. 在一个候选族中最优就宣称在全部函数中最优。

### 自检

1. 两条控制末端相同，为什么代价仍不同？
2. 候选族中的扰动为什么不改变本例末端状态？

**核对要点**：输入平方积分包含整个过程；扰动1-2t在[0,1]内的积分为零。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
