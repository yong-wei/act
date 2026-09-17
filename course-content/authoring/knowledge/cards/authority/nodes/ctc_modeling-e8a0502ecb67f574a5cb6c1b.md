---
node_id: ctc_modeling-e8a0502ecb67f574a5cb6c1b
authority_entity_id: "ctc:modeling-e8a0502ecb67f574a5cb6c1b"
name: "梅森公式通路余子式"
name_en: "Path Cofactor in Mason's Formula"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a83a3e328abd3e1afec27e5a4a26a9d61717474e20b7a9ef1397b49411b64f3d.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a83a3e328abd3e1afec27e5a4a26a9d61717474e20b7a9ef1397b49411b64f3d.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-07a/previous/ctc_modeling-e8a0502ecb67f574a5cb6c1b.md"
asset_refs: []
---

## 首页

# 梅森公式通路余子式 | Path Cofactor in Mason's Formula

**一句话定义**：通路余子式从特征式中排除所有包含接触该通路回路的项，包括混合乘积项。

**核心直觉**：一个回路被排除后，含有它的每一项都要一起排除，不能只删它单独出现的那一项。

**关键公式**：本例针对第一通路，$\Delta_1=1-L_2$，而不是保留 $L_1L_2$ 的残式。

**学习目标**：在已展开的特征式中正确筛除回路项，发现遗漏混合项的余子式错误。

---

## 详情

### 完整解释

构造余子式可从两种角度理解：一是只保留不接触指定通路的回路，重新写特征式；二是在完整特征式的各项中，删除任何含有接触回路的项。两种方法应得到同一结果。第二种方法适合检查已经展开的长表达式，但必须跟踪每个乘积项由哪些回路构成。

“删去回路项”不只是把 $-L_i$ 从式子中拿掉。若 $L_i$ 与其他回路形成了合法的二次、三次乘积，这些项也包含 $L_i$，同样不能留在该余子式中。常数项 1 则保留。余子式是对指定通路的辅助代数构造，不是实际修改系统连接。

### 教学计算/推理例

共同图有两个不接触回路：$L_1$ 的节点为 $\{x,y\}$，增益 $-3/10$；$L_2$ 是节点 $q$ 的自环，增益 $1/5$。完整特征式为
$$
\Delta=1-L_1-L_2+L_1L_2.
$$
第一条前向通路 $r\to x\to y\to z$ 接触 $L_1$。逐项检查可知，$-L_1$ 与 $+L_1L_2$ 都包含被排除的回路，必须同时删除，剩下
$$
\Delta_1=1-L_2=\frac45.
$$
第二条通路 $r\to y\to z$ 也接触 $L_1$，所以 $\Delta_2=4/5$。第三条通路 $r\to q\to z$ 接触 $L_2$，应删除 $-L_2$ 与 $+L_1L_2$，于是
$$
\Delta_3=1-L_1=\frac{13}{10}.
$$
这些结果与直接对剩余回路重新构造特征式一致。将它们分别乘以通路增益 $6,1,2$，得到分子 $41/5$，再除以 $\Delta=26/25$ 得整图增益 $205/26$。若余子式仍残留被排除回路的乘积项，这一核对就会失败。

### 适用条件与边界

同一图的不同通路可能排除不同回路，不能把某一条通路的余子式复制给所有通路。复杂图中需要对每个乘积项逐一检查：只要其中任意一个回路接触通路，该项就排除。这里的“余子式”按梅森信号流图规则定义，不应仅凭名称就把它当作某个任意矩阵元素对应的代数余子式进行行列删除。

### 常见误区

1. **误区**：排除 $L_1$ 只需删掉 $-L_1$。**纠正**：本例还必须删 $+L_1L_2$。
2. **误区**：常数项也属于被删回路的一部分。**纠正**：没有保留回路时，余子式仍从 1 开始。

### 自检

1. 第一通路的余子式为什么不含 $L_1L_2$？
2. 怎样用另一种方法检查已经筛选出的表达式？

**核对要点**：混合项包含接触第一通路的 $L_1$；只用剩下的不接触回路重新构造特征式，应得到相同结果。

### 关联节点

本卡的核心结论可由上述节点方程与回路乘积独立复核。
