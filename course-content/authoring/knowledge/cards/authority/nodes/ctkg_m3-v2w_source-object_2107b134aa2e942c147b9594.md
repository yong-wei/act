---
node_id: ctkg_m3-v2w_source-object_2107b134aa2e942c147b9594
authority_entity_id: "ctkg:m3-v2w:source-object:2107b134aa2e942c147b9594"
name: "用于拉普拉斯逆变换的 Heaviside 部分分式展开"
name_en: "Heaviside Partial-Fraction Expansion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-3a27a62d3da06bc4baab9714d43f2d22cd6519c7cf84f6077133063b15ec6abe.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-3a27a62d3da06bc4baab9714d43f2d22cd6519c7cf84f6077133063b15ec6abe.json"
asset_refs: []
---

## 首页

# 用于拉普拉斯逆变换的 Heaviside 部分分式展开 | Heaviside Partial-Fraction Expansion

**一句话定义**：部分分式展开把适当的有理函数拆成与极点对应的简单项，便于逐项求逆拉普拉斯变换。

**核心直觉**：先分清每个极点对应的项，再读出指数和时间因子，不能只记“盖住分母”而忽略重根。

**关键公式**：本例 $F(s)=\frac{1/2}{s+1}+\frac{1/2}{s+3}$。

**学习目标**：计算简单极点的留数，核对展开式，并识别重极点需要不同处理。

---

## 详情

### 完整解释

对因果信号的适当有理变换式，部分分式将整体表达分解为容易查表或直接积分的项。简单极点对应指数项，重极点可能带来乘以时间幂的项，复共轭极点则可组合成实数形式的衰减正弦。展开不仅便于计算，也能显示不同动态模态对响应的贡献。

简单极点处可通过先乘去对应的一次因子，再代入该极点求留数。这种方法依赖极点是简单的；如果同一因子重复出现，就需要保留不同幂次的展开项，并使用相应求系数方法。分子次数不低于分母时，还应先处理多项式部分，不能直接套用严格真有理情形的形式。

### 教学计算/推理例

取归一化变量下
$$
F(s)=\frac{s+2}{(s+1)(s+3)}=\frac A{s+1}+\frac B{s+3}.
$$
在 $s=-1$ 处求得
$$
A=\left.\frac{s+2}{s+3}\right|_{s=-1}=\frac12,
$$
在 $s=-3$ 处求得
$$
B=\left.\frac{s+2}{s+1}\right|_{s=-3}=\frac12.
$$
重新通分，分子为 $\tfrac12(s+3)+\tfrac12(s+1)=s+2$，说明展开与原式一致。因此因果逆变换在 $t\ge0$ 为
$$
f(t)=\frac12e^{-t}+\frac12e^{-3t}.
$$
两项的衰减速率不同，不能因为系数相同就把它们合并成一个指数。另一个固定例子 $1/(s+1)^2$ 的逆变换是 $t e^{-t}$，而不是两份 $e^{-t}$；重复因子改变了所需的函数形式。

### 适用条件与边界

本卡采用因果逆变换及相应收敛域，不能只给出一个代数分式就忽略信号的时间支持条件。求得时域函数后，可重新进行拉普拉斯积分或通分核对。留数的符号与大小反映该分解项的贡献，不一定各自都能解释为一个独立物理部件的响应；完整结果仍应满足原方程和初始条件。

### 常见误区

1. **误区**：重根也只需代入一次简单盖住公式。**纠正**：必须包含各阶重复极点项并按相应规则求系数。
2. **误区**：$1/(s+1)^2$ 对应 $2e^{-t}$。**纠正**：对应 $t e^{-t}$，时间因子不能丢失。

### 自检

1. 本例两个留数为什么均为 $1/2$？
2. 怎样不依赖查表检查部分分式系数是否正确？

**核对要点**：分别在两个简单极点乘去对应因子后代入；通分应恢复原分子与分母。

### 关联节点

- **部分分式展开**（无向，关系：相关）
- **部分分式展开的覆盖法**（无向，关系：相关）
- **不同极点部分分式展开法**（无向，关系：相关）
