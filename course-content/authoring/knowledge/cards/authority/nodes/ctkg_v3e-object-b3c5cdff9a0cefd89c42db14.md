---
node_id: ctkg_v3e-object-b3c5cdff9a0cefd89c42db14
authority_entity_id: "ctkg:v3e-object-b3c5cdff9a0cefd89c42db14"
name: "绝对稳定性"
name_en: "Absolute Stability in Linear System Classification"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d0215eb3430ad4b9c10a6789755262bdd099356cb95d270c12872f55eb0923b8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d0215eb3430ad4b9c10a6789755262bdd099356cb95d270c12872f55eb0923b8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-16a/previous/ctkg_v3e-object-b3c5cdff9a0cefd89c42db14.md"
asset_refs: []
---

## 首页

# 绝对稳定性 | Absolute Stability in Linear System Classification

**一句话定义**：在本卡的线性系统分类语境中，绝对稳定性先回答闭环是否稳定，而不量化它距离失稳边界有多远。

本卡采用连续时间内部渐近稳定口径，并与稳定程度、鲁棒性及非线性中的同名术语区分。

---

## 详情

### 完整解释

分析一个给定闭环时，首先需要确认它是否具有所要求的稳定性质，然后才讨论衰减多快、允许参数变化多大或距离边界多远。这里的“绝对”是与“相对稳定程度”相对的分类用语，不表示所有参数、所有对象误差和所有运行条件下都已经获得稳定保证。

本卡用有限维连续时间线性闭环的内部渐近稳定作明确判断标准：完整状态矩阵的特征值应严格位于左半平面。在最小输入输出描述中，可通过相应特征多项式判断；若存在未显露的内部模态，还必须保留它们，不能只凭一个约消后的通道下结论。

这一二元判断的信息量有限。两个系统都稳定，仍可能有非常不同的衰减速度和过渡过程。若一个极点很靠近虚轴，模态衰减较慢，参数变化也可能较容易影响结论；但这些更细的判断需要进一步计算，不能仅从“稳定”两个字获得。

### 教学计算/推理例

取两个闭环特征多项式

$$p_1(s)=(s+1)(s+2)(s+3),\qquad p_2(s)=(s+2)(s+4)(s+6).$$

两者所有根都严格位于左半平面，因而对应的完整线性模型都可满足渐近稳定。就本卡的“是否稳定”问题而言，结论相同。

但第一组根最靠近虚轴的位置是-1，第二组是-2，模态衰减尺度不同。如果进一步构造无零点、单位静态增益的对应传递函数，第二组是第一组的时间缩放版本。这里之所以能谈这种对应，是因为分子和全部极点也作了匹配，不是仅凭“更稳定”三个字推断了输出性能。

再取 $p_3(s)=(s+1)(s-0.1)$，它有右半平面根0.1，即使另一根为-1，仍存在增长模态，不能判为渐近稳定。如果只观察短时间输出，缓慢增长可能尚不明显；根位置给出了有限观察之外的判断依据。

对于含虚轴根的例子，应单列边界性质，而不是把它纳入本卡要求的严格渐近稳定。是否在Lyapunov或BIBO意义下稳定还需依照相应定义说明。

### 适用条件与边界

非线性控制文献中的“绝对稳定性”常有另一套专门语境，例如对一类满足扇区条件的非线性考察稳定保证。不能把本卡的线性二元分类直接当成那些定理的含义，更不能用一张线性劳斯表代替非线性条件的验证。阅读时应先确认对象和术语所处章节。

“绝对稳定”也不等于全局稳定、参数鲁棒稳定或全部性能合格。模型不确定、时延变化和执行器饱和都可能需要独立分析。一个名义线性模型严格稳定，只证明该模型在已声明条件下的性质；应按实际问题补充稳定裕度和性能指标。

因此，合理顺序是先说明稳定定义与闭环模型，再给是否稳定的结论，最后按任务需求继续评估稳定程度。避免把相近术语混在一起，比给系统贴一个看似更强的标签更有用。

### 常见误区

1. 误区：绝对稳定表示任何参数变化下都不会失稳。纠正：本语境只判断给定模型是否稳定，不自动包含鲁棒保证。
2. 误区：两个系统都稳定，就具有相同衰减速度。纠正：根位置和响应系数仍不同，需要相对稳定性及动态性能分析。

### 自检

1. $p_1$与 $p_2$的二元稳定结论相同，是否意味着它们的极点距离虚轴相同？
2. 能否把本卡结论直接当作非线性扇区绝对稳定定理？

**核对要点**：两者都严格稳定，但最近极点分别为-1和-2。非线性同名术语有额外模型与条件，不能直接替换。

### 关联节点

- **稳定性**（入边，关系：前置于）
- **稳定性**（出边，关系：属于）
- **不稳定性**（无向，关系：相关）
