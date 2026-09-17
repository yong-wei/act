---
node_id: ctc_modeling-v2r-5585bf06f0e579bc1c362ac2
authority_entity_id: "ctc:modeling-v2r-5585bf06f0e579bc1c362ac2"
name: "回路"
name_en: "Loop"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4ab1ba445d60667ab8f10690bb08875742b59d343679718515a38ba70941afe4.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4ab1ba445d60667ab8f10690bb08875742b59d343679718515a38ba70941afe4.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-06a/previous/ctc_modeling-v2r-5585bf06f0e579bc1c362ac2.md"
asset_refs: []
---

## 首页

# 回路 | Loop

**一句话定义**：信号流图中的基本回路沿支路方向从一个节点出发回到该节点，中途不重复其他节点。

**核心直觉**：把同一圈从另一个位置开始数，仍是同一个回路；连续绕两圈也不是新增一个基本回路。

**关键公式**：本例基本回路为 $x\to y\to x$，增益为 $-0.3$。

**学习目标**：识别基本有向回路，避免重复计数，并区分回路、前向路径和一般闭合游走。

---

## 详情

### 完整解释

回路的起点和终点是同一节点，除这个必要的返回外，其他节点不能重复经过。箭头方向必须连贯：即使图上几条线围成一个几何形状，如果方向不能一路走回起点，也不是有向回路。判断依据是连接关系，不是图形看上去是否封闭。

回路可以参与反馈，使一个变量通过其他关系又影响自身。一个基本回路有多个写法，例如可从其中任意一个节点开始列出同一圈；这些写法不应重复计数。一般闭合游走则允许重复节点和支路，范围比基本回路宽。后续使用回路组合公式时，必须先明确统计的是基本回路。

### 教学计算/推理例

共同图的支路为 $r\to x:2$、$x\to y:3$、$y\to x:-0.1$、$r\to y:1$、$y\to z:1$。唯一基本回路是
$$
x\to y\to x,
\qquad L=3(-0.1)=-0.3.
$$
写成 $y\to x\to y$ 只是换了起点，经过的有向支路和乘积完全相同。$r$ 没有入边，无法沿图内支路回到它；$z$ 没有出边，也不能成为这个图中回路的一部分。

若写 $x\to y\to x\to y\to x$，它连续遍历同一回路两次，乘积为 $(-0.3)^2=0.09$。这个乘积说明两次遍历的组合变换，但不能据此把它登记为第二个基本回路，否则会无限重复计数。

从节点方程 $x=2r-0.1y$、$y=3x+r$ 可消元得到 $y=7r-0.3y$。右端含自身变量项，正是图中反馈回路的代数体现。最终 $y=z=(70/13)r$，与只看两条前向路径得到的增益和 7 不同。

### 适用条件与边界

本例只有一个基本回路，不能由此推断一般图也只有一个。较复杂图还需区分回路是否共享节点；共享节点就接触，即使没有共享支路也一样。当前例子只有常数增益，不把回路存在等同于振荡或不稳定。回路表示结构上的反馈依赖，是否振荡还取决于动态与参数。

### 常见误区

1. **误区**：$x\to y\to x$ 与 $y\to x\to y$ 是两个回路。**纠正**：只是同一回路的不同起点写法。
2. **误区**：图上任何闭合外形都是回路。**纠正**：必须检查每条箭头是否允许沿方向返回起点。

### 自检

1. 为什么 $r$ 与 $z$ 不属于本例任何基本回路？
2. 绕同一圈两次为什么不应加入基本回路清单？

**核对要点**：$r$ 无入边、$z$ 无出边；两次遍历重复经过节点，属于更一般的闭合游走。

### 关联节点

- **信号流图**（出边，关系：组成部分属于）
- **不接触回路**（无向，关系：相关）
