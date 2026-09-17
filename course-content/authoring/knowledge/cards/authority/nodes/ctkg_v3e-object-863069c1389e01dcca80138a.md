---
node_id: ctkg_v3e-object-863069c1389e01dcca80138a
authority_entity_id: "ctkg:v3e-object-863069c1389e01dcca80138a"
name: "临界稳定"
name_en: "Marginal Stability"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1a1cedc5c2722520bf27abd3c0ce8942190353498be7453061c34674b96ac0af.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1a1cedc5c2722520bf27abd3c0ce8942190353498be7453061c34674b96ac0af.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-15a/previous/ctkg_v3e-object-863069c1389e01dcca80138a.md"
asset_refs: []
---

## 首页

# 临界稳定 | Marginal Stability

**一句话定义**：临界稳定在此指零输入扰动可保持有界、但不必衰减的边界状态，必须与渐近稳定和BIBO稳定区分。

“不会越来越大”与“最终回到平衡”是两个不同要求。

---

## 详情

### 完整解释

先围绕平衡点理解稳定性。Lyapunov稳定要求初始扰动足够小时，后续运动始终足够接近平衡点；渐近稳定还要求这种运动最终趋近平衡点。前者不强制误差消失，因此一个保持恒定小幅度的自由振荡可以稳定，却不是渐近稳定。

在线性定常连续时间系统中，严格左半平面的特征值给出渐近衰减。特征值落到虚轴后，边界模态不再衰减；若虚轴部分的Jordan块都为一阶，且没有右半平面特征值，则零输入运动可以保持有界。这种边界情形常称临界稳定。

不能把它说成脱离定义的“既不稳定也不不稳定”。在Lyapunov意义下它可能稳定，在渐近意义下不满足要求，在BIBO意义下又可能不稳定。明确所用定义，比记住一个模糊的中间标签更重要。实际分析报告应写出状态、输入和被验证的性质。

### 教学计算/推理例

考虑二维旋转系统

$$\dot x=\begin{bmatrix}0&1\\-1&0\end{bmatrix}x.$$

其特征值是 $\pm j$。定义 $V=x_1^2+x_2^2$，沿原方程求导得 $\dot V=0$，因此状态长度始终等于初始长度。给定任何允许的偏离尺度，只要初始长度更小，后续就一直保持在该尺度内。这直接说明原点Lyapunov稳定。

但非零初态会沿圆周持续运动，状态不趋于零，所以原点不渐近稳定。这里的边界状态不是由采样图“看起来没变大”猜出来，而是由原方程的长度不变性质给出。

再比较两个具有重复零特征值的矩阵。若 $A=0$，则任意初态保持常值，零输入运动稳定但不渐近稳定。若

$$A=\begin{bmatrix}0&1\\0&0\end{bmatrix},\qquad x(0)=\begin{bmatrix}0\\\varepsilon\end{bmatrix},$$

则 $x_1(t)=\varepsilon t,\ x_2(t)=\varepsilon$。无论非零 $\varepsilon$ 多小，第一状态最终都会超过固定范围，因此原点不稳定。两者特征值都为零，却因Jordan结构不同而得到不同结果。

### 适用条件与边界

重复特征值并不自动导致不稳定，关键是虚轴模态是否有非平凡Jordan块。相反，简单虚轴极点是常见的充分识别线索，但不能把所有状态空间边界情形都限制为“根在代数上只能出现一次”。处理多状态模型时，应检查特征向量和Jordan结构。

输入输出问题还需要另一层分析。给无阻尼振子加入有界共振输入，可以出现幅值增长，因此临界的零输入稳定性不提供BIBO保证。实际控制通常需要一定衰减与稳定裕度，临界状态也不等于具有良好的工程鲁棒性。

本卡结论针对有限维线性定常系统。非线性模型的线性化在出现零实部特征值时通常不足以单独作出局部稳定性结论，还需采用适用的非线性分析；不能直接把线性边界判据当作所有非线性系统的最终答案。

### 常见误区

1. 误区：有界自由振荡意味着渐近稳定。纠正：渐近稳定还要求回到平衡，持续非零振荡不满足这一点。
2. 误区：重复零特征值一定不稳定。纠正：应检查Jordan结构，零矩阵与缺陷Jordan块就是不同例子。

### 自检

1. 旋转系统为何稳定却不渐近稳定？
2. 两个零特征值的例子中，哪个结构引入了线性时间增长？

**核对要点**：状态长度保持不变，足够小初态保持小，但非零状态不会趋零。非平凡Jordan块使解出现 $\varepsilon t$，而零矩阵只保持初态不变。

### 关联节点

- **稳定性**（入边，关系：前置于）
- **稳定性**（出边，关系：属于）
- **无阻尼振荡**（无向，关系：相关）
