---
node_id: ctkg_v3e-canonical-115de5ef0289a778cf5b69c6
authority_entity_id: "ctkg:v3e-canonical-115de5ef0289a778cf5b69c6"
name: "终值定理"
name_en: "Final Value Theorem"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c3343e1111f2ace6dadfacfb099db7b5d93d9668e583a9002f49e7467aa23ad3.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c3343e1111f2ace6dadfacfb099db7b5d93d9668e583a9002f49e7467aa23ad3.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-115de5ef0289a778cf5b69c6.md"
asset_refs: []
---

## 首页

# 终值定理 | Final Value Theorem

**一句话定义**：在 sF(s) 的极点满足稳定条件时，用 lim(s→0)sF(s) 求时间函数终值。

**核心直觉**：终值公式是收敛性条件下的极限交换，先判极点才能相信结果。

**关键公式**：
$$
lim(t→∞)f(t)=lim(s→0)sF(s)
$$

**学习目标**：判断终值定理的适用条件，并区分终值与直流增益。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

若 f(t) 最终收敛，拉氏域的低频极限可以恢复终值。常见误用是对持续振荡或发散信号直接令 s=0；例如 F(s)=1/(s²+1) 会给出形式上的 0，但时间函数没有终值。

### 教学计算/推理例

F(s)=1/[s(s+2)] 时，sF(s)=1/(s+2)，所以终值为 1/2。其极点 −2 在左半平面，条件满足。

### 适用条件与边界

要求 sF(s) 没有右半平面极点或虚轴极点（可按课程约定处理稳定的左半平面情形）。初值、冲激和离散终值需使用相应版本。

### 自检

1. F(s)=1/[s(s+2)] 的终值是多少？
2. F(s)=1/(s²+1) 能否把 s=0 代入得到终值？

**核对要点**：为 1/2；不能，时间函数持续振荡，终值不存在。

### 关联节点

- **部分分式展开**（出边，关系：由此得到）
- **终值定理仅适用于稳定系统**（入边，关系：适用于）
- **离散系统的终值定理**（出边，关系：相关）
- **求离散传递函数的直流增益时，对单位阶跃输入应用终值定理：x_ss = lim_{z→1} (1-z^{-1}) X(z)。**（出边，关系：相关）
