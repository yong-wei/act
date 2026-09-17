---
node_id: ctkg_domainconcept_ce5faebdf847052fdb481b31
authority_entity_id: "ctkg:domainconcept:ce5faebdf847052fdb481b31"
name: "渐近稳定性"
name_en: "Asymptotic Stability"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6cdda0ee785e99a936a6c948a4e70bf66d436051b2127b5a81776ad9ab143bdf.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6cdda0ee785e99a936a6c948a4e70bf66d436051b2127b5a81776ad9ab143bdf.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-05a/previous/ctkg_domainconcept_ce5faebdf847052fdb481b31.md"
asset_refs: []
---

## 首页
# 渐近稳定性 | Asymptotic Stability

一句话定义：平衡点渐近稳定，是指它既在李雅普诺夫意义下稳定，又能吸引某个邻域内的状态，使这些轨迹随时间趋向该平衡点。

- 渐近稳定同时包含稳定与吸引两个要求。
- 趋于平衡点不要求有限时间准确到达。
- 渐近收敛可以很慢，不一定是指数收敛。

---
## 详情
### 完整解释

以原点为参照，首先需要满足小初始扰动使轨迹始终保持在任意给定小邻域内的稳定性要求；其次还需要存在一个吸引邻域，使其中每个初态的解在时间趋于无穷时趋于零。二者共同组成局部渐近稳定，而“全局”版本则要求吸引范围覆盖整个状态空间并保证前向解存在。

渐近稳定讨论极限，不要求状态在某个有限时刻恰好变成零。给定任意小误差容限，收敛轨迹最终会进入并留在该容限内，但不同初值、不同起始时刻的等待时间可能不同；若要求统一等待时间，还应明确一致渐近稳定条件。

### 教学计算/推理例

考虑一维自治系统 $\dot x=-x^3$。对起始时刻 $t_0$ 和初值 $x_0$，其解为

$$
x(t)=\frac{x_0}{\sqrt{1+2x_0^2(t-t_0)}},\qquad t\geq t_0.
$$

分母不小于1，所以 $|x(t)|\leq|x_0|$，对任意epsilon取delta等于epsilon即可证明稳定。对非零初值，分母随时间无界增长，所以状态趋于零；零初值则始终为零。解对所有未来时刻存在，因此原点实际上全局渐近稳定。

选 $V=x^2/2$ 也可得到 $\dot V=x(-x^3)=-x^4$。V正定且径向无界，导数在非零点严格为负，与解析解的结论一致。这种直接法不必先求完整轨迹，但仍需核对所采用定理的全局条件。

若从 $x_0=1$ 出发，希望 $|x(t)|\leq0.1$，由 $1/\sqrt{1+2(t-t_0)}\leq0.1$ 得 $t-t_0\geq49.5$。收敛虽然确定，却可能比直观预期慢很多；在有限时间图中看起来下降缓慢，并不能据此否认渐近稳定。

### 渐近与指数的区别

指数稳定要求在某个邻域内存在统一正常数M和alpha，使 $|x(t)|\leq M e^{-\alpha(t-t_0)}|x_0|$。本例对任何固定非零初值只按时间平方根的倒数衰减，长期比任何固定指数都慢，因此不能用上述指数上界覆盖全部未来时间。

这也解释了为何线性化的零特征值不能直接证明不稳定：本例在原点的导数为0，但三次项仍将状态推向原点。相反的 $\dot x=x^3$ 具有相同零线性化，却会把非零状态推离原点。边界线性化情形需要额外非线性分析。

### 适用条件与边界

局部渐近稳定只保证某个邻域内的吸引性，不能省略吸引域限制。像 $\dot x=-x+x^3$ 在原点附近收敛，但在外侧存在不同运动，不能由原点线性化稳定就推断全局稳定。

本卡的V和解析式针对无外部输入的连续时间自治系统。持续扰动可能导致非零最终偏差；无扰动渐近稳定本身不等于对所有扰动的精确零误差保证。时间变化系统还应分清普通吸引与对初始时刻一致的吸引。

### 常见误区

1. 把渐近收敛误读成在有限时间完全到达平衡点。
2. 将渐近稳定无条件替换成指数稳定。
3. 由局部结论直接承诺任意初值均收敛。

### 自检

1. 本例如何分别证明稳定和吸引？
2. 为什么本例不满足局部指数稳定？

**核对要点**：范数不增证明稳定，解析解极限为零证明吸引；任意固定非零初值仅代数衰减，无法被固定指数衰减上界长期覆盖。

### 关联节点

- **平衡状态稳定性**（无向，关系：相关）
- **李雅普诺夫稳定性**（无向，关系：相关）
- **李雅普诺夫意义下的稳定性**（无向，关系：相关）
