---
node_id: ctkg_v3e-canonical-af52bd97e7b277a781f1e7ef
authority_entity_id: "ctkg:v3e-canonical-af52bd97e7b277a781f1e7ef"
name: "直流增益"
name_en: "DC Gain"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-956bb941ab70005a6141bbe00959499baf30a828c89693d5c08ee240903fc876.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-956bb941ab70005a6141bbe00959499baf30a828c89693d5c08ee240903fc876.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-af52bd97e7b277a781f1e7ef.md"
asset_refs: []
---

## 首页

# 直流增益 | DC Gain

**一句话定义**：稳定系统在零频率处的输入输出增益。

**核心直觉**：直流只看长期不变输入，等价于把传递函数取 s=0，但前提是终值存在。

**关键公式**：
$$
G_DC=G(0)=lim(s→0)G(s)
$$

**学习目标**：计算有限直流增益，并识别积分器导致的直流增益发散。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

直流增益是频率响应在 ω=0 的极限，也是稳定系统单位阶跃终值的比例。它与闭环误差和开环 Kp 有关但不等同；若传递函数含原点极点，G(0)可能不存在，不能硬写成无限输出。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

取 G(s)=5/(2s+1)，G_DC=5，单位阶跃终值为 5。若 G(s)=1/s，则直流增益不为有限常数，单位阶跃输出是斜坡。

### 适用条件与边界

要求系统稳定且对该通道终值有限。对闭环、对象和控制器分别报告直流增益，不能跨通道套用。

### 自检

1. G(s)=5/(2s+1) 的直流增益是多少？
2. 含积分器的系统能否直接用 G(0) 作为阶跃终值？

**核对要点**：为 5；不能，先检查终值是否存在并使用终值定理。

### 关联节点

- **闭环系统单位阶跃稳态误差**（入边，关系：相关）
