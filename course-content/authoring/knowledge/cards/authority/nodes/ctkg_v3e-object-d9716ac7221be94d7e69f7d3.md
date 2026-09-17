---
node_id: ctkg_v3e-object-d9716ac7221be94d7e69f7d3
authority_entity_id: "ctkg:v3e-object-d9716ac7221be94d7e69f7d3"
name: "卡尔曼状态空间分解"
name_en: "Kalman State-Space Decomposition"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8e6b0fe81b93355816198daa380d89eb2102d4a25ec908d0c08099de49f93433.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8e6b0fe81b93355816198daa380d89eb2102d4a25ec908d0c08099de49f93433.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-04a/previous/ctkg_v3e-object-d9716ac7221be94d7e69f7d3.md"
asset_refs: []
---

## 首页
# 卡尔曼状态空间分解 | Kalman State-Space Decomposition

一句话定义：卡尔曼状态空间分解通过可逆坐标变换揭示可控、不可控、可观测与不可观测部分，说明输入输出表示与内部动态之间的关系。

- 状态坐标变换保留原系统动态信息。
- 零状态传递函数可能遗漏不可控或不可观测的内部模态。
- 一般分解是结构化分块，不要求每个状态都独立成对角形式。

---
## 详情
### 完整解释

对线性定常系统，输入能够从零态驱动的状态方向形成可达子空间，不能由输出辨识的方向形成不可观测子空间。选取与这些子空间相适应的基，可以将系统矩阵写成揭示相应结构的分块形式。这种变换改变状态坐标，不改变输入输出关系，也不删除原系统的初始状态效应。

教学上常将结构分为可控可观、可控不可观、不可控可观、不可控不可观四类。一般系统的块之间仍可能存在符合结构的耦合，不能把四类自动理解成四组互不影响的对角元素。零状态传递函数的最小实现只需保留可控可观的有效部分，而完整内部状态分析仍需考虑其余模态。

### 教学计算/推理例

为了把四类作用分开观察，选取已经处于简单分解坐标中的模型

$$
A=\operatorname{diag}(-1,-2,-3,-4),\quad
B=\begin{pmatrix}1\\1\\0\\0\end{pmatrix},\quad
C=\begin{pmatrix}1&0&1&0\end{pmatrix}.
$$

输入驱动第一、第二状态，输出读取第一、第三状态。第一状态可控可观；第二状态可控不可观；第三状态不可控可观；第四状态既不可控也不可观。可控性矩阵的后两行均为零，前两行独立，因此秩为2；可观测性矩阵的第二、第四列均为零，第一、第三列独立，因此秩也为2。

在零初态下，第三、第四状态不会被输入激发，而第二状态虽被输入激发却不进入输出。因此 $G(s)=C(sI-A)^{-1}B=1/(s+1)$，最小实现只需一阶。四阶内部模型与一阶最小输入输出实现并不矛盾，它们回答的问题不同。

若第三状态初值为a，即使输入为零，输出还会包含 $a e^{-3t}$。这个分量无法从上述零状态传递函数计算出来。若将第四个对角元由-4改成+4，零状态传递函数仍不改变，但第四状态的非零初值会指数增长，说明外部传函稳定不能单独证明任意非最小实现内部稳定。

### 适用条件与边界

本例特意使用对角模型，使分类可以直接读出。一般模型必须通过可控性与可观测性子空间计算确定合适坐标，不能只看原始B的零行或C的零列，因为动力耦合可能传播输入或输出信息。坐标变换后A、B、C必须一起变换，才能保持描述一致。

最小实现的降阶是针对零状态输入输出等价，不是对原物理系统任意初态的无损替代。若任务涉及内部约束、安全、初值响应或反馈设计，就不能仅凭某模态不出现在传函中而忽略它。数值实现还需关注秩容差和状态尺度，近似不可控与严格不可控不能混用。

### 常见误区

1. 传递函数阶次较低，就认定对象没有其他内部状态。
2. 把一般卡尔曼分解误认为一定得到完全对角矩阵。
3. 删除不可控或不可观测模态后，仍声称保持所有初值响应。

### 自检

1. 本例第二状态为什么不出现在传递函数中？
2. 第四极点改成+4后，外部传函和内部稳定性分别怎样？

**核对要点**：它受输入驱动但不影响输出；外部零状态传函不变，内部存在可由非零初值激发的不稳定模态。

### 关联节点

- **可观测性**（出边，关系：用于分析）
