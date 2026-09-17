---
node_id: ctkg_m1q_source_93f9cb978a744de81099410b
authority_entity_id: "ctkg:m1q:source:93f9cb978a744de81099410b"
name: "线性二次型问题"
name_en: "Linear-Quadratic Control Problem"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
coneightt_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-61e367a1d23c09575f21064d37c1b744de8dab8871fc4d4e9647c9a7491d1ce9.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-61e367a1d23c09575f21064d37c1b744de8dab8871fc4d4e9647c9a7491d1ce9.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-07a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 线性二次型问题 | Linear-Quadratic Control Problem

一句话定义：线性二次型问题以线性动态和二次型性能指标描述控制优化任务，并在适当条件下得到线性状态反馈。

- “线性”描述动态，“二次型”描述指标。
- 时域与末端条件属于问题定义。
- 无约束解不自动适用于输入或状态硬约束。

---
## 详情
### 完整解释

连续时间有限时域线性二次型问题通常给定 $\dot x=Ax+Bu$、初态及终止时刻T，并最小化 $J=\frac12x(T)^TFx(T)+\frac12\int_0^T(x^TQx+u^TRu)\,dt$。标准情形下Q、F对称半正定，R对称正定；系统与权重也可以在满足相应正则性条件时随时间变化。

这个结构的价值在于动态对状态和输入线性，而代价具有可分析的凸二次结构。它不意味着任意受约束问题都由同一个矩阵公式直接解决。固定终点、自由终点、输入饱和、有限时域与无限时域，都可能改变求解条件与结果形式。

### 教学计算/推理例

取标量积分器 $\dot x=u$、$x(0)=x_0$，区间[0,1]，末端自由，输入为平方可积实值函数。令Q=R=F=1，得到

$$
J=\frac12x(1)^2+\frac12\int_0^1(x^2+u^2)\,dt.
$$

沿轨迹有 $\frac{d}{dt}(x^2/2)=xu$。利用恒等式 $(u+x)^2=u^2+2xu+x^2$，积分并整理得到

$$
J=\frac12x_0^2+\frac12\int_0^1(u+x)^2\,dt.
$$

第二项对每个可行控制都非负，因此总成本不小于初态平方的一半。令u=-x使平方项恒为零，状态为 $x(t)=x_0e^{-t}$，所以最小成本确为 $x_0^2/2$。这是覆盖全部可行输入的充分性证明，不只是把一个候选代入后得到较小数值。

对x0=1，末端为 $e^{-1}$，末值成本为 $e^{-2}/2$。过程成本为 $\int_0^1e^{-2t}\,dt=(1-e^{-2})/2$，两者相加正好1/2。若漏掉末值项，这个计算与原优化问题都将发生变化。

### 与矩阵方程的联系

本例Riccati微分方程为 $-\dot P=1-P^2$，终端条件P(1)=1，因此P(t)=1在整个区间成立，反馈u=-Px就是u=-x。这里常增益来自终端权重恰好选在该方程的常值解上；一般有限时域问题的增益会随时间变化。

把成本统一乘以同一个正数不会改变最优控制，但会改变最小成本的数值。本卡始终保留1/2因子，求导、Riccati表达和成本核对使用同一约定。若只改变某一项的系数，就相当于改变相对权重，不能再认为最优控制保持不变。

### 适用条件与边界

若初态为2且要求输入幅值不超过1，则u=-x在初始时刻要求输入-2，不符合硬约束。此时需要解决受约束问题，而不是继续把原来的无约束公式当成可行最优解。状态约束、切换动态和明显的非线性也需要单独处理。

无限时域通常用代数Riccati方程及可稳定、可检测等条件讨论稳定最优反馈；有限时域则带终端条件，不能直接把两种问题互换。对非线性模型作局部线性化后得到的LQ设计，其适用范围仍受线性近似区域限制。

### 常见误区

1. 把线性二次型问题理解为动态方程也含状态平方。
2. 遗漏有限时域的末值项或终端条件。
3. 有幅值上限时仍直接声称无约束解可行。

### 自检

1. 本例哪一个恒等式直接证明了全局最小性？
2. 为什么本例常增益不能代表所有有限时域情况？

**核对要点**：总成本等于初态平方的一半加非负平方积分；P恒为1依赖特定的终端权重，其他终端条件通常产生时变解。

### 关联节点

- **对称根轨迹法**（无向，关系：相关）
- **线性二次型调节器**（无向，关系：相关）
