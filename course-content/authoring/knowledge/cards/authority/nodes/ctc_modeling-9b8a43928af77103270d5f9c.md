---
node_id: ctc_modeling-9b8a43928af77103270d5f9c
authority_entity_id: "ctc:modeling-9b8a43928af77103270d5f9c"
name: "不接触回路"
name_en: "Nontouching Loops"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fe43a30885f62452caac2dc55aefbea1dd8e4349cbbfc9167797b2412a974924.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fe43a30885f62452caac2dc55aefbea1dd8e4349cbbfc9167797b2412a974924.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-07a/previous/ctc_modeling-9b8a43928af77103270d5f9c.md"
asset_refs: []
---

## 首页

# 不接触回路 | Nontouching Loops

**一句话定义**：两个或多个回路没有任何共同节点时，称它们互不接触。

**核心直觉**：判断接触要看节点集合，不能只看两条回路是否共用一段线。

**关键公式**：本例 $V(L_1)=\{x,y\}$、$V(L_2)=\{q\}$，两集合交集为空。

**学习目标**：识别不接触回路组合，并解释哪些乘积项应进入特征式。

---

## 详情

### 完整解释

“不接触”是信号流图中的拓扑条件。一个回路与另一个回路只要共享一个变量节点，就发生接触；即使它们使用不同支路，也不能当作不接触组合。反过来，画图时两条线在纸面上交叉，并不自动形成公共节点；只有模型中确实存在共同变量节点时才算接触。

这个条件决定梅森特征式中哪些回路乘积可以出现。单回路项需要全部基本回路；二回路乘积只取不接触的一对；三回路乘积要求三个回路两两不接触。不能先把回路增益全部相乘，再补做一个模糊的“是否独立”判断。

### 教学计算/推理例

共同图由 $x=2r-0.1y$、$y=3x+r$、$q=4r+0.2q$、$z=y+0.5q$ 描述。第一个回路 $L_1$ 沿 $x\to y\to x$，节点集合为 $\{x,y\}$，增益为 $-3/10$；第二个回路 $L_2$ 是 $q\to q$ 自环，节点集合为 $\{q\}$，增益为 $1/5$。

两集合没有公共元素，所以它们是不接触回路。虽然两组信号最终都影响输出 $z$，但 $z$ 不在任一回路的闭合路径中，不能把“共同影响输出”误判为“回路接触”。外部输入 $r$ 也不是这两个回路的节点。

这一对回路的增益乘积为
$$
L_1L_2=-\frac3{10}\frac15=-\frac3{50},
$$
应进入特征式的二次项，所以
$$
\Delta=1-(L_1+L_2)+L_1L_2=\frac{26}{25}.
$$
图中只有两个基本回路，没有三回路组合。把同一回路换起点写一遍，不会增加回路数量，也不能拿它与自己组成所谓“不接触回路对”。

### 适用条件与边界

回路之间是否接触，与回路是否接触某条前向通路，是两个不同的检查步骤。前者决定全图特征式中的组合；后者决定某个通路余子式可以留下哪些回路。应分别列出相应节点集合，避免把两种筛选条件混在一起。本例是常数增益代数图，不接触并不意味着实际物理系统完全没有耦合或共享约束。

### 常见误区

1. **误区**：没有共同支路就一定不接触。**纠正**：共享一个节点也构成接触。
2. **误区**：都通向同一个输出，所以两个回路接触。**纠正**：应检查输出是否真的位于各回路上，本例不是。

### 自检

1. 本例为什么允许列入 $L_1L_2$？
2. 画面上两条支路线交叉但没有共同变量节点，是否必然接触？

**核对要点**：回路节点集合不相交；几何交叉不等于模型中的公共节点，应依据变量与连接定义判断。

### 关联节点

- **回路**（无向，关系：相关）
