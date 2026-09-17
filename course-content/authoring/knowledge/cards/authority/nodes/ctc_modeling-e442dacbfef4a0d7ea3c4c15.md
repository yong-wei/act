---
node_id: ctc_modeling-e442dacbfef4a0d7ea3c4c15
authority_entity_id: "ctc:modeling-e442dacbfef4a0d7ea3c4c15"
name: "闭环反馈互联"
name_en: "Closed-Loop Feedback Interconnection"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ca0cc588e5903e939dfeb5a75d67ac289f2c0e6eceab425ab92edd68cd0822f3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ca0cc588e5903e939dfeb5a75d67ac289f2c0e6eceab425ab92edd68cd0822f3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-05a/previous/ctc_modeling-e442dacbfef4a0d7ea3c4c15.md"
asset_refs: []
---

## 首页

# 闭环反馈互联 | Closed-Loop Feedback Interconnection

**一句话定义**：闭环反馈互联把输出经反馈通路送回比较点，使输入、输出和反馈信号形成相互依赖的关系。

**核心直觉**：反馈符号决定方程中的加减号，但良定义性和稳定性仍要由消元结果、闭环极点以及内部动态共同检查。

**关键公式**：负反馈得到 $Y/R=2/(s+2)$，正反馈得到 $Y/R=2/s$。

**学习目标**：区分动态正反馈与静态代数环，判断闭环关系是否有唯一输出以及是否存在有限稳态。

---

## 详情

### 完整解释

闭环反馈互联的关键不在于画出一条回线，而在于回线让输出再次进入输入关系。读图时先确定反馈通路的变量和符号，再写比较点方程，最后与前向方框方程联立。这样才能区分一个具有动态记忆的闭环与一个没有唯一输入输出映射的代数环。

先看同一动态对象
$$
G(s)=\frac{2}{s+1},\qquad H(s)=0.5.
$$
负反馈时，比较点为 $e=r-0.5y$，零初态下对象关系为 $(s+1)Y=2E$。代入并整理得到
$$
(s+1)Y=2R-Y,\qquad \frac{Y}{R}=\frac{2}{s+2}.
$$
闭环极点为 $-2$，单位阶跃输入的响应为
$$
y(t)=1-e^{-2t},
$$
因此存在有限稳态值。这个结论来自当前方程和极点，不是由“负反馈”三个字单独保证的。

正反馈时，比较点改为 $e=r+0.5y$。同一动态对象于是满足
$$
(s+1)Y=2\left(R+0.5Y\right)=2R+Y,\qquad \frac{Y}{R}=\frac{2}{s}.
$$
对单位阶跃输入，$Y(s)=2/s^2$，所以 $y(t)=2t$，输出持续增长，没有有限稳态。正反馈在这里仍然给出了一个动态输入输出关系，只是闭环极点位于原点，响应不收敛。

再看静态正反馈的临界情形。若前向增益为 $2$、反馈比例为 $0.5$，比较点和方框关系是
$$
e=r+0.5y,\qquad y=2e.
$$
代入后得到 $e=r+e$，等价地
$$
0=2r.
$$
当 $r$ 非零时，这个方程没有解；当 $r=0$ 时，任意满足 $y=2e$ 的 $e$ 都可以成立，输出不唯一。因此这里不是“增益趋于无穷大”的普通传递函数，而是代数环没有定义出唯一的输入输出映射。除非加入新的动态或约束，否则不能把它当成一个可用闭环模型。

### 教学计算/推理例

把三种情况并列检查：动态负反馈的分母为 $s+2$，单位阶跃趋向一；动态正反馈的分母为 $s$，单位阶跃为 $2t$；静态临界正反馈的消元式为 $0=2r$，非零输入无解、零输入不唯一。它们都画出了反馈回线，但数学性质完全不同，所以必须先写方程，再使用“稳定”“无穷增益”或“等效”的词语。

### 适用条件与边界

本例使用同一线性定常对象和反馈比例，动态结论以零初态为条件。负反馈符号不普遍保证稳定，还要检查闭环极点和可能的内部动态；正反馈也不必然立即无解，动态储能会产生一个可计算但可能不收敛的闭环。静态回路在 $1-GH=0$ 时必须先判断存在性和唯一性，不能直接做除零运算。

### 常见误区

1. **误区**：所有正反馈都没有输入输出解，所有负反馈都稳定。**纠正**：动态正反馈本例有 $Y/R=2/s$，只是单位阶跃无有限稳态；负反馈仍需由极点和内部动态判断稳定性。
2. **误区**：静态正反馈的分母为零只表示增益无限大，可以继续把它当作普通传递函数。**纠正**：临界代数环对非零输入无解、对零输入不唯一，尚未形成良定义的输入输出模型。

### 自检

1. 为什么同一个 $G(s)$ 在正、负反馈下分别得到 $2/s$ 和 $2/(s+2)$？
2. 静态正反馈满足 $0=2r$ 时，$r=0$ 与 $r\ne0$ 的解集分别是什么？

**核对要点**：比较点的符号改变了消元后的特征因子；$r\ne0$ 时没有满足关系的解，$r=0$ 时存在一族满足 $y=2e$ 的解，因而输出不唯一。

### 关联节点

- **闭环传递函数**（无向，关系：相关）
- **正反馈内回路**（无向，关系：相关）
