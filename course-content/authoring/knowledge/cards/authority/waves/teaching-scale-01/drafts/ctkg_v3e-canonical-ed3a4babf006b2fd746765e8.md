---
node_id: ctkg_v3e-canonical-ed3a4babf006b2fd746765e8
authority_entity_id: "ctkg:v3e-canonical-ed3a4babf006b2fd746765e8"
name: "调节与扰动抑制的系统类型"
name_en: "System Type for Regulation and Disturbance Rejection"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c707845c80ac2cfe2042896c4f354a45b0a8a98d55a3da4672fc62f9a6925b9a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c707845c80ac2cfe2042896c4f354a45b0a8a98d55a3da4672fc62f9a6925b9a.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-ed3a4babf006b2fd746765e8.md"
asset_refs: []
---

## 首页

# 调节与扰动抑制的系统类型 | System Type for Regulation and Disturbance Rejection

**一句话定义**：按指定扰动通道对多项式扰动的低频抑制能力分类的系统类型。

**核心直觉**：系统型别必须和扰动入口一起说；同一环路对参考和不同扰动通道的结论可能不同。

**关键公式**：
$$
L(s)≈K/sⁿ near s=0,  S(s)=1/(1+L(s))
$$

**学习目标**：给定扰动通道后，从误差传递函数判断能抑制哪一阶多项式扰动。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

本卡的系统类型不是把“参考跟踪型别”换个名称。对直接叠加在误差通道的扰动，灵敏度 S 的低频阶次决定残余；对对象入口扰动，还要乘对象到误差的传递函数。没有扰动入口和稳定性条件时，单报“Ⅰ型”是不完整的。

### 教学计算/推理例

取 L(s)=10/s、直接加在误差通道的扰动。常值扰动 D=1/s 时 E=SD=1/(s+10)，终值为 0；单位斜坡扰动 D=1/s² 时 E=1/[s(s+10)]，终值为 0.1。一个积分器能消除常值扰动，但不能消除斜坡扰动。

### 适用条件与边界

要求指定扰动通道、反馈符号、低频模型和闭环稳定。若扰动经对象、前馈或滤波器进入，必须用完整通道重算。

### 自检

1. 一个积分器对常值误差扰动的稳态残余是多少？
2. 同一型别能否不看入口就断言所有扰动都被消除？

**核对要点**：在该通道和稳定条件下为 0；不能，入口和通道动态会改变结论。

### 关联节点

- **扰动抑制**（出边，关系：相关）
- **系统类型**（出边，关系：相关）
