---
node_id: ctkg_domainconcept_00c33c72030aa254c651c5ad
authority_entity_id: "ctkg:domainconcept:00c33c72030aa254c651c5ad"
name: "正定性（标量函数）"
name_en: "Positive Definiteness of a Scalar Function"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
confifteent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7c43541458a3df9832e71ced5a0813516ffb0d2ab7d5c693c0a5c7aeb4838f1d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7c43541458a3df9832e71ced5a0813516ffb0d2ab7d5c693c0a5c7aeb4838f1d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_00c33c72030aa254c651c5ad.md"
asset_refs: []
---

## 首页
# 正定性（标量函数） | Positive Definiteness of a Scalar Function

一句话定义：以原点为参照，标量函数正定是指它在原点取零，并在指定区域内每个非零状态处严格为正。

- 正定性必须说明参照点与适用区域。
- 多变量函数要检查所有非零方向。
- 函数正定本身不能单独证明系统稳定，还需考察沿轨迹的变化。

---
## 详情
### 完整解释

设D是包含原点的邻域，连续标量函数V在D内满足 $V(0)=0$，且对所有 $x\in D\setminus\{0\}$ 有 $V(x)>0$，则称V在D内正定。可以把它理解成一种衡量偏离平衡状态的量：在平衡点归零，偏离任意非零方向都会变成正值，但它不必是实际机械能。

如果结论只在某个邻域内成立，应称局部正定；若在整个状态空间成立，才可称全局正定。换成非零平衡点时，需要相应平移坐标或明确以该平衡点为参照。只说“V大于零”而不检查平衡点取值与所有方向，不能完整说明正定性。

### 教学计算/推理例

取二维状态 $x=(x_1,x_2)^T$，定义 $V=x_1^2+2x_2^2$。在原点V为0；若x非零，至少有一个平方项严格为正，因此V严格为正。还可得到

$$
\lVert x\rVert^2\leq V(x)\leq2\lVert x\rVert^2.
$$

这组界说明V同时约束两个状态分量，V很小时整个状态向量的欧氏范数也很小。对照函数 $U=x_1^2$，虽然永远非负，但在非零点 $(0,1)^T$ 仍为0，不能据此判断整个状态都接近平衡点；U是正半定，未达到正定的严格要求。

再看 $W=x_1^2-x_2^2$：在 $(1,0)^T$ 取1，在 $(0,1)^T$ 取-1，因而非定号。只检查第一坐标轴或少数正值点会得出错误判断。对于二次型 $V=x^TPx$，可先用对称部分表示，再检查对应对称矩阵的特征值是否都严格为正；本例P为 $\operatorname{diag}(1,2)$。

### 与稳定性分析的关系

使用正定函数分析系统时，还需要给出动力学。对于 $\dot x_1=-x_1$、$\dot x_2=-x_2$，本例V的导数为 $\dot V=-2x_1^2-4x_2^2$，离开原点后严格为负；若动力学改为 $\dot x=x$，同一个V的导数则为正。可见正定性是函数自身的性质，沿轨迹是否下降取决于函数与系统的组合。

正定不等于径向无界。例如一维函数 $x^2/(1+x^2)$ 全局正定，但当状态绝对值趋于无穷时只趋于1。涉及全局稳定的定理若另要求径向无界，就必须单独验证，不能由正定性自动代替。

### 适用条件与边界

本卡讨论不显含时间的连续标量函数。时变李雅普诺夫分析常需要用与时间无关的正定函数对 $V(t,x)$ 作统一下界，逐个时刻为正并不足以代替这一要求。函数可微性不是正定定义本身的必要部分，但若要沿微分方程计算导数，还需满足所采用定理的光滑条件。

### 常见误区

1. 有非零零点的非负函数也称为正定。
2. 只检查一条坐标轴或有限个样本点就证明所有方向正定。
3. 把函数正定直接当成系统稳定的完整证明。

### 自检

1. $x_1^2+2x_2^2$ 为什么能约束整个状态范数？
2. $x^2/(1+x^2)$ 是否正定，是否径向无界？

**核对要点**：它不小于 $\lVert x\rVert^2$；全局正定，但不径向无界，因为远处趋于1。

### 关联节点

- **不定性（标量函数）**（无向，关系：相关）
- **正半定性（标量函数）**（无向，关系：相关）
- **能量函数（李雅普诺夫）**（无向，关系：相关）
