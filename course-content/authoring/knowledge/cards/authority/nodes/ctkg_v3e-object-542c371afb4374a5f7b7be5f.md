---
node_id: ctkg_v3e-object-542c371afb4374a5f7b7be5f
authority_entity_id: "ctkg:v3e-object-542c371afb4374a5f7b7be5f"
name: "矩阵指数函数"
name_en: "Matrix Exponential"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-56535d095b5177aa141175aa5d9dad21ba9dc3683bb06dd218184b9b2e81798b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-56535d095b5177aa141175aa5d9dad21ba9dc3683bb06dd218184b9b2e81798b.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-03a/previous/ctkg_v3e-object-542c371afb4374a5f7b7be5f.md"
asset_refs: []
---

## 首页
# 矩阵指数函数 | Matrix Exponential

一句话定义：矩阵指数 $e^{At}$ 由矩阵幂级数定义，是描述线性定常系统零输入状态演化的基本矩阵函数。

- 运算使用矩阵乘法，不是对各元素逐个取指数。
- $e^{A0}=I$，初始时刻保持原状态。
- 重复特征值的系统不一定可以对角化。

---
## 详情
### 完整解释

对有限维方阵 $A$，定义 $e^{At}=I+At+(At)^2/2!+\cdots$。该级数收敛，且满足 $d(e^{At})/dt=Ae^{At}$。因此 $\dot x=Ax$ 的解为 $x(t)=e^{At}x(0)$。

同一常矩阵具有半群关系 $e^{A(t_1+t_2)}=e^{At_1}e^{At_2}$。对于不同矩阵，$e^{A+B}=e^Ae^B$ 并非无条件成立，通常需要交换等条件。不能把标量指数的全部代数规则未经检查搬到矩阵上。

### 教学计算/推理例

取

$$
A=\begin{pmatrix}-1&1\\0&-1\end{pmatrix}=-I+N,\qquad
N=\begin{pmatrix}0&1\\0&0\end{pmatrix},\quad N^2=0.
$$

因为 $-I$ 与 $N$ 交换，且 $N$ 的高阶幂为0，有

$$
e^{At}=e^{-t}(I+tN)=e^{-t}\begin{pmatrix}1&t\\0&1\end{pmatrix}.
$$

对初态 $(0,1)^T$，得到 $x(t)=(t e^{-t},e^{-t})^T$。第一状态虽然初值为0，仍因上三角耦合被第二状态激发。若把A的每个元素分别取指数，会得到完全错误的矩阵，连 $t=0$ 时的单位矩阵条件都不满足。

该矩阵的两个特征值都为 $-1$，但存在非对角Jordan结构，响应包含 $t e^{-t}$。不能只看到重复特征值就把系统当成两个独立的 $e^{-t}$ 模态。这个多项式因子最终仍被指数衰减压过，状态趋于0。

### 适用条件与边界

矩阵指数可描述常系数齐次状态方程，但非零输入还需卷积积分项。仅计算 $e^{At}x(0)$ 不能得到受迫响应。对时变矩阵 $A(t)$，状态转移一般也不能写成 $e^{A(t)t}$，须使用满足相应微分方程的转移矩阵。

相似变换下有 $e^{T^{-1}ATt}=T^{-1}e^{At}T$，说明坐标改变不会改变物理状态演化，只改变表示。数值计算矩阵指数时应使用适当算法；简单截断少数级数项对任意矩阵和时间未必足够准确。

系统稳定性与特征值及模态结构有关。连续时间渐近稳定的常矩阵需要所有特征值实部严格为负；边界虚轴模态还要检查Jordan结构，不能只凭“指数形式”三个字断定衰减。

### 常见误区

1. 把矩阵指数当成逐元素指数。
2. 对不交换矩阵随意拆分指数乘积。
3. 忽略输入项或时变条件，扩大常矩阵公式范围。

### 自检

1. 本例 $e^{A0}$ 是什么？
2. 初态第二分量为1为何会产生非零第一分量？

**核对要点**：为单位矩阵；上三角项引入耦合，第一分量为 $t e^{-t}$，不是始终为0。

### 关联节点

- **矩阵指数**（无向，关系：相关）
- **零输入响应**（无向，关系：相关）
- **系统状态矩阵**（无向，关系：相关）
