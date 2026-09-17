---
node_id: ctc_modeling-bddaef2510e39cbb62d60df2
authority_entity_id: "ctc:modeling-bddaef2510e39cbb62d60df2"
name: "结构图环节方框"
name_en: "Block Diagram Element"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5a123ebbe1ae9742f4b7a5f964be0f8dbb9016daa00cfd7c8c554b0a2c062dd6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5a123ebbe1ae9742f4b7a5f964be0f8dbb9016daa00cfd7c8c554b0a2c062dd6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-05a/previous/ctc_modeling-bddaef2510e39cbb62d60df2.md"
asset_refs: []
---

## 首页

# 结构图环节方框 | Block Diagram Element

**一句话定义**：环节方框用传递函数表示一个输入信号到输出信号的数学变换。

**核心直觉**：先说明输入、输出和初态，再使用方框关系；传递函数只描述零状态贡献，初态会另加自由响应。

**关键公式**：$G(s)=2/(s+1)$ 对应 $\dot y+y=2u$。

**学习目标**：从一个方框的输入输出关系区分零状态传递关系与非零初态响应。

---

## 详情

### 完整解释

环节方框的作用是把一段数学变换标在信号流向上。方框左侧的输入先约定单位和方向，右侧的输出再由方框中的传递函数或等价微分方程确定。方框因此是一种模型边界：它可以对应一个实际元件，也可以把几个元件或一个子系统合并在一起。读方框时，最先要问的是“这个关系在什么初态下成立”，而不是只把方框当作一个乘号。

固定方框为
$$
G(s)=\frac{2}{s+1}.
$$
若输入记为 $u$、输出记为 $y$，对应的时域方程是
$$
\dot y+y=2u.
$$
这条方程说明输入是怎样驱动输出变化的，也说明方框含有一个动态状态。零初态下，对单位阶跃输入 $u(t)=1$，方程的稳态特解为 $2$，齐次项为衰减项，于是
$$
y(t)=2\left(1-e^{-t}\right).
$$
在同一条件下，拉氏域的零状态关系写成
$$
Y(s)=G(s)U(s).
$$
这里的 $Y=GU$ 是输入造成的零状态贡献，不是对任意初态都完整有效的总响应公式。

把初态改为 $y(0)=1$，而输入仍是同一个单位阶跃，方程的稳态部分仍为 $2$，但自由响应的系数由初态决定，得到
$$
y(t)=2-e^{-t}.
$$
与零初态结果相比，差别正是由初始能量或初始状态留下的自由响应。若只写 $Y=GU$ 而不声明零初态，就会把这部分响应漏掉；若把初态随意当作另一个外部输入，也会混淆输入通道和状态条件。

这个例子还说明“方框”与“物理部件”不是同义词。一个方框可以表示一个已合并的动态关系，多个方框也可以共同表示一个实际装置的不同状态或测量关系。只要输入、输出、单位和初态声明清楚，方框就能作为可计算的局部模型与其他方框连接。

### 教学计算/推理例

先写方程，再代入输入和初态。对 $u(t)=1$，先由 $\dot y+y=2$ 找到稳态值 $2$，再用初始条件确定指数项：$y(0)=0$ 得到 $2(1-e^{-t})$，$y(0)=1$ 得到 $2-e^{-t}$。两个结果共享同一方框和同一输入，区别来自自由响应，正好检验了传递函数与初态条件的边界。

### 适用条件与边界

本例是线性定常方框，且 $Y=G U$ 的表述采用零初态。非零初态、外部扰动、饱和或额外未建模动态需要单独加入相应状态方程，不能从方框中的传递函数自动推断。学生可先用输入输出关系读懂方框，再在需要时回到微分方程核对自由响应。

### 常见误区

1. **误区**：方框写有 $G(s)$，所以任何情况下总响应都能直接写成 $Y=GU$。**纠正**：传递函数描述零状态输入输出贡献；非零初态还会产生自由响应。
2. **误区**：每个方框必须对应一个独立物理元件，方框之间不能合并。**纠正**：方框表示数学变换的边界，可以代表元件、子系统或已合并的关系。

### 自检

1. 为什么同一个 $G(s)=2/(s+1)$ 在 $y(0)=0$ 与 $y(0)=1$ 时得到不同响应？
2. 使用 $Y=G U$ 前，需要先声明哪一个状态条件？

**核对要点**：初态改变了齐次自由响应的系数；$Y=G U$ 的直接乘法关系以零初态为条件，非零初态要另加自由响应。

### 关联节点

- **结构图绘制规范步骤**（无向，关系：相关）
