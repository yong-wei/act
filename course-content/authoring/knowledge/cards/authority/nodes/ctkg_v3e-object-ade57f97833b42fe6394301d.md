---
node_id: ctkg_v3e-object-ade57f97833b42fe6394301d
authority_entity_id: "ctkg:v3e-object-ade57f97833b42fe6394301d"
name: "可控性PBH秩判据法"
name_en: "PBH Controllability Test"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e055e2a1d9f2a3b099beaf3b6836032d975eb3c4fbe62b488d3820a3c9eb94c8.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e055e2a1d9f2a3b099beaf3b6836032d975eb3c4fbe62b488d3820a3c9eb94c8.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-03a/previous/ctkg_v3e-object-ade57f97833b42fe6394301d.md"
asset_refs: []
---

## 首页
# 可控性PBH秩判据法 | PBH Controllability Test

一句话定义：对有限维线性定常系统，PBH可控性判据要求对A的每个特征值检验 $[\lambda I-A\ B]$ 的秩是否等于状态维数。

- 必须检查全部特征值，包括复特征值。
- 某个模态秩亏说明存在输入无法作用的状态方向。
- 可控性与系统当前稳定性是不同性质。

---
## 详情
### 完整解释

对状态矩阵 $A\in\mathbb R^{n\times n}$、输入矩阵 $B\in\mathbb R^{n\times m}$，PBH判据为 $\operatorname{rank}[\lambda I-A\ B]=n$，对A的所有特征值成立时系统完全可控。等价地，不存在非零左特征向量 $q^*$ 同时满足 $q^*A=\lambda q^*$ 和 $q^*B=0$。

这个左特征向量条件说明某个模态对输入没有作用通道。对复特征值，秩在复数域检验，不能只检查实数轴上的几个试点。非特征值处 $\lambda I-A$ 已可逆，不能用这种容易满秩的点代替真正的模态检查。

### 教学计算/推理例

取 $A=[[-3,-2],[1,0]]$、$B=[1,0]^T$，A的特征值为 $-1,-2$。当 $\lambda=-1$，拼接矩阵为 $[[2,2,1],[-1,-1,0]]$，秩为2；当 $\lambda=-2$，矩阵为 $[[1,2,1],[-1,-2,0]]$，秩也为2。因此两种模态都可控，与可控性矩阵行列式1一致。

再取 $A_h=\operatorname{diag}(-1,2)$、$B_h=[1,0]^T$。在 $\lambda=2$，矩阵为 $[[3,0,1],[0,0,0]]$，秩仅为1。左特征向量 $[0,1]$ 与B相乘为0，第二状态满足 $\dot x_2=2x_2$，输入无法改变它的增长。

如果只检查 $\lambda=-1$，会得到满秩却漏掉不可控的不稳定模态。此反例说明“某一次PBH满秩”不足以证明整个系统可控。

### 适用条件与边界

PBH可控性判据针对线性定常有限维模型，不自动覆盖一般时变系统、输入饱和或时域约束。秩满只说明代数可控性，并不保证所需控制能量小或实现对噪声不敏感。

重复特征值不能仅按特征值出现次数重复做同一数值计算就代替正确秩分析；PBH矩阵已经包含相应模态结构。数值上接近秩亏时，应考虑尺度和容差，不能把浮点软件的一个整数秩输出当成无条件精确证明。

稳定但不可控模态可以存在，因此不可控不总等于当前系统不稳定。若只要求通过反馈稳定系统，涉及更弱的可镇定性条件，应另作定义，不能与全可控混同。

### 常见误区

1. 只测试一个特征值或测试非特征值。
2. 可控性判据中误用右特征向量正交条件，混淆矩阵方向。
3. 把不可控与必然不稳定直接画等号。

### 自检

1. 第二组在 $\lambda=2$ 的秩为什么不足2？
2. 原系统极点全在左半平面，是否就必然完全可控？

**核对要点**：第二行全零，输入不能作用到该模态；稳定性与输入可达方向不同，稳定系统也可能不可控。

### 关联节点

- **PBH秩判据**（入边，关系：属于）
