---
node_id: ctkg_domainconcept_fef4835248def04a043183ee
authority_entity_id: "ctkg:domainconcept:fef4835248def04a043183ee"
name: "闭环系统"
name_en: "Closed-Loop System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5cc72d5a7e0f977d0b9c1086ebaea8b325571d87dbf90e1be5b79824de1bc1f6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5cc72d5a7e0f977d0b9c1086ebaea8b325571d87dbf90e1be5b79824de1bc1f6.json"
  - "git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/最优闭环系统渐近稳定性_10_897d7b2f.md"
asset_refs: []
---

## 首页

# 闭环系统 | Closed-Loop System

**一句话定义**：利用反馈把输入、控制器、对象和测量通道闭合起来后的系统。

**核心直觉**：闭环的特征方程来自回路增益，公共分母决定反馈后的自然动态。

**关键公式**：
$$
\Phi(s)=\frac{Y(s)}{R(s)}=\frac{G(s)}{1+G(s)H(s)}
$$

**学习目标**：由闭环信号方程求传递函数，并检查闭环极点而不是只看开环对象。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

闭环系统的“闭合”是信号关系闭合，不只是图上画一条线。负反馈单位反馈时，开环对象 $G$ 经过 $1+G$ 的分母变成闭环关系；参考、扰动、噪声仍有不同的通道分子。开环稳定不保证闭环稳定，闭环性能必须对实际闭环极点和通道分别检查。

### 教学计算/推理例

取 $G(s)=4/(s+2)$、$H=1$，则 $\Phi(s)=4/(s+6)$。单位阶跃的稳态输出为 $4/6=2/3$，闭环极点从对象的 $-2$ 变为 $-6$。

### 适用条件与边界

适用负反馈、线性定常、零初始条件且分母没有不当消去。反馈符号或测量动态变化时应重新推导。

### 自检

1. $G=4/(s+2)$ 的闭环特征方程是什么？
2. 闭环极点更靠左是否单独证明所有性能都更好？

**核对要点**：为 $s+6=0$；不能，还需检查超调、控制量、噪声和模型误差。

### 关联节点

- **开环系统**（入边，关系：相关）
- **闭环系统传递函数**（出边，关系：相关）
