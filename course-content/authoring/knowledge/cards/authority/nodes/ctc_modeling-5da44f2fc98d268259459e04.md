---
node_id: ctc_modeling-5da44f2fc98d268259459e04
authority_entity_id: "ctc:modeling-5da44f2fc98d268259459e04"
name: "脉冲响应"
name_en: "Impulse Response"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4b323ae543f9754514da5236f56663be4c775e9700ddf063dfa8990acc4954da.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4b323ae543f9754514da5236f56663be4c775e9700ddf063dfa8990acc4954da.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-10a/previous/ctc_modeling-5da44f2fc98d268259459e04.md"
asset_refs: []
---

## 首页

# 脉冲响应 | Impulse Response

**一句话定义**：脉冲响应是系统在零初始状态下受到单位冲激输入时产生的输出。

**核心直觉**：用一个单位面积的瞬时作用观察系统怎样继续运动，而不是把输入简单设成高度为 1 的短矩形。

**关键公式**：本例 $G(s)=2/(s+1)$，$h(t)=2e^{-t}$，$t>0$。

**学习目标**：由状态方程或传函求脉冲响应，解释冲激引起的状态跳变，并区分零状态与非零初态。

---

## 详情

### 完整解释

单位冲激是面积为 1 的理想分布，不是一个普通的有限高度函数。脉冲响应描述这个理想输入经过系统后的结果。对于因果线性定常系统，它还能用于卷积计算任意适当输入的零状态响应，因此既是测试响应，也是系统动态的一种表达。

“零初始状态”指冲激到来之前没有需要额外计入的储能状态。冲激本身可以在瞬间改变状态，所以冲激之后的状态不一定仍为零。这与有限幅值阶跃通过严格真有理对象时状态保持连续并不矛盾，两种输入的数学性质不同。

### 教学计算/推理例

采用归一化时间与变量，取
$$
\dot y+y=2u,\qquad G(s)=\frac2{s+1}.
$$
令 $u=\delta(t)$，并规定 $y(0^-)=0$。在包含原点的极短区间两侧积分，$\dot y$ 项给出状态差；有限的 $y$ 项在区间收缩时积分趋于零，而单位冲激积分为 1，故
$$
y(0^+)-y(0^-)=2,\qquad y(0^+)=2.
$$
在 $t>0$ 时输入已为零，方程变为 $\dot y+y=0$，因此
$$
h(t)=2e^{-t},\qquad t>0.
$$
从拉普拉斯域看，单位冲激的变换为 1，零状态下 $Y=G\cdot1$，逆变换得到同样结果。这里 $h(0^+)=2$ 是冲激作用后的右极限，不表示输入冲激只有高度 2。

如果冲激前存在非零初态，还要叠加该初态的零输入响应。脉冲响应本身仍指零状态下的那部分，不能把不同初态测得的总输出都直接称为同一个 $h(t)$。

### 适用条件与边界

实际设备通常只能施加有限宽度脉冲，必须核对其面积、执行器限制和脉宽相对于系统动态是否足够短。脉冲响应也不是所有系统都能用一条固定曲线描述：这里采用线性定常假设。若系统有直接传递项，脉冲响应还可能包含冲激分量，而不仅是普通衰减函数；本例严格真有理，未包含该项。

### 常见误区

1. **误区**：单位冲激就是高度 1 的短脉冲。**纠正**：单位指面积，脉宽缩小时高度需要相应增大。
2. **误区**：零初态意味着 $y(0^+)$ 也必须为零。**纠正**：冲激可造成状态跳变，本例跳到 2。

### 自检

1. 本例从零状态为何能在冲激后立即得到 $y=2$？
2. 为什么 $t>0$ 的输出按自然衰减方程继续演化？

**核对要点**：跨越冲激积分得到状态增量 2；冲激只在原点作用，此后输入为零。

### 关联节点

- **传递函数**（无向，关系：相关）
- **单位脉冲响应**（无向，关系：相关）
