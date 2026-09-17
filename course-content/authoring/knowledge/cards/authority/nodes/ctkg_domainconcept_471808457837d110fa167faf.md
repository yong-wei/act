---
node_id: ctkg_domainconcept_471808457837d110fa167faf
authority_entity_id: "ctkg:domainconcept:471808457837d110fa167faf"
name: "负定性（标量函数）"
name_en: "Negative Definiteness"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d71821115e760f09597b0ce113f0fe57a99adbf52b01e67c4063dc616a562755.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d71821115e760f09597b0ce113f0fe57a99adbf52b01e67c4063dc616a562755.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_471808457837d110fa167faf.md"
asset_refs: []
---

## 首页
# 负定性（标量函数） | Negative Definiteness

一句话定义：以原点为参照，标量函数负定是指在原点取零，并在指定区域内每个非零状态处严格为负，即其相反数正定。

- 负定函数的零点在指定区域内只有原点。
- 负定不等于每个表达式系数都为负。
- 在稳定性分析中常检查李雅普诺夫函数的沿轨迹导数是否负定。

---
## 详情
### 完整解释

设W是包含原点的区域D上的连续标量函数。若 $W(0)=0$，并且每个 $x\in D\setminus\{0\}$ 都满足 $W(x)<0$，则W在D内负定。等价地，$-W$ 在同一区域内正定。这一定义关注函数对所有状态方向的符号，与函数是二次、多项式还是其他形式无关。

负定性也有区域限制。一个函数可能在原点附近负定，但远处出现零点或正值。陈述结论时应说明局部还是全局，尤其不能将局部导数条件直接写成任意大初始状态都收敛的依据。

### 教学计算/推理例

令 $W=-x_1^2-2x_2^2$。只要状态非零，至少一个平方项为正，因此W严格为负；原点处W为零，并有 $W\leq-\lVert x\rVert^2$。对应的对称二次型矩阵为 $\operatorname{diag}(-1,-2)$，两个特征值都为负。

对照函数 $U=-x_1^2$ 在所有点非正，但在 $(0,1)^T$ 取零，故是负半定而非负定。再看 $Z=-x_1^2+x_2^2$，沿第一坐标轴为负，沿第二坐标轴为正，属于非定号。取几个负值样本不足以证明负定，非零零点也必须排除。

交叉项的符号也不能单独决定性质。例如 $W_c=-x_1^2+2x_1x_2-2x_2^2=-(x_1-x_2)^2-x_2^2$，虽然交叉项系数为正，整体仍负定。两个平方项同时为零迫使 $x_2=0$ 且 $x_1=x_2=0$，提供了完整的代数证明。

### 与稳定性分析的关系

若系统为 $\dot x_1=-x_1$、$\dot x_2=-2x_2$，选 $V=(x_1^2+x_2^2)/2$，则 $\dot V=-x_1^2-2x_2^2=W$。V正定、导数负定，在满足直接法其余条件时可证明原点渐近稳定。这里有用的是W确实等于给定V沿给定系统轨迹的导数，而不是任意找到一个负定函数就完成稳定性证明。

考虑一维 $W(x)=-x^2+x^4$：在 $0<|x|<1$ 时为负，在 $|x|=1$ 时为零，超过1时为正。若它来自 $V=x^2/2$ 和 $\dot x=-x+x^3$，只能利用原点附近的负定区域建立局部结论，不能宣布全局渐近稳定。

### 适用条件与边界

连续负定函数在每个不包含原点的紧环形区域上有严格负的上界，但该上界可以随区域靠近原点而趋于零。因此“处处严格负”并不自动意味着存在统一线性衰减速度；例如 $\dot V=-x^4$ 可能产生代数衰减，需要进一步条件才能证明指数稳定。

时变函数还需检查与时间无关的负定上界等一致性条件，不能把每个固定时刻的严格负值直接解释为一致收敛。计算轨迹导数时也应计入V的显式时间偏导。

### 常见误区

1. 有负系数就认定函数负定，不检查交叉项和全部方向。
2. 忽略局部负定区域，直接宣称全局收敛。
3. 将导数严格为负等同于状态必然按指数速度衰减。

### 自检

1. $-x_1^2+2x_1x_2-2x_2^2$ 为什么负定？
2. $-x^2+x^4$ 在全实数域负定吗？

**核对要点**：可写成两个负平方项之和，且共同零点仅原点；不成立，它只在原点附近的 $|x|<1$ 区域负定。

### 关联节点

- **负半定性（标量函数）**（无向，关系：相关）
- **能量函数（李雅普诺夫）**（无向，关系：相关）
