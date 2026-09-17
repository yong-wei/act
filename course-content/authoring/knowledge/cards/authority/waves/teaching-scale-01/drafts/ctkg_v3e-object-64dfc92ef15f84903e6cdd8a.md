---
node_id: ctkg_v3e-object-64dfc92ef15f84903e6cdd8a
authority_entity_id: "ctkg:v3e-object-64dfc92ef15f84903e6cdd8a"
name: "极点配置补偿器设计"
name_en: "Pole-Placement Compensator Design"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-45a0aa44db67766733b9273d5601d84941a5127846360290815a53223d81e042.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-45a0aa44db67766733b9273d5601d84941a5127846360290815a53223d81e042.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-64dfc92ef15f84903e6cdd8a.md"
asset_refs: []
---

## 首页

# 极点配置补偿器设计 | Pole-Placement Compensator Design

**一句话定义**：通过状态反馈选择闭环极点，使可控系统达到指定动态特性。

**核心直觉**：反馈增益改变闭环特征多项式；先确认能控，再把目标多项式系数匹配回增益。

**关键公式**：
$$
u=−Kx,  A_cl=A−BK
$$

**学习目标**：用特征多项式匹配设计状态反馈，并核对输入符号约定。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

极点配置补偿器设计把“希望多快、多少阻尼”翻译成闭环极点。它不是给任意系统增加一个神奇补偿器：若系统不可控，某些模态不能由 K 移动；若状态不可测，还需要观测器或输出反馈。

### 教学计算/推理例

取 A=[[0,1],[-2,-3]]、B=[[0],[1]]，K=[k₁,k₂]。A−BK 的特征多项式为 s²+(3+k₂)s+(2+k₁)。目标 (s+2)(s+4)=s²+6s+8，故 k₁=6、k₂=3。

### 适用条件与边界

假设连续 LTI、全状态可用、输入未饱和且使用 u=−Kx 约定。极点配置后的时域指标仍需仿真和执行器验证。

### 自检

1. 目标极点为 −2、−4 时 K 是多少？
2. 不可控模态能否通过增大 K 任意移动？

**核对要点**：为 [6,3]；不能，不可控模态不能由该输入反馈任意配置。

### 关联节点

- 当前权威邻域仅返回该节点本身，未添加推测关系。
