---
node_id: ctkg_v3e-canonical-09e1c3e14609b082a4501ead
authority_entity_id: "ctkg:v3e-canonical-09e1c3e14609b082a4501ead"
name: "静态误差系数法求稳态误差"
name_en: "Static Error Coefficient Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-a2feb663fd251f889389f4ce65929302641a91d8fd9dd3dd1741454f8b658d4f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-a2feb663fd251f889389f4ce65929302641a91d8fd9dd3dd1741454f8b658d4f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-09e1c3e14609b082a4501ead.md"
asset_refs: []
---

## 首页

# 静态误差系数法求稳态误差 | Static Error Coefficient Method

**一句话定义**：按输入是阶跃、斜坡还是抛物线，利用 Kp、Kv、Ka 计算稳态误差的方法。

**核心直觉**：输入的低频阶次和环路积分器数量决定哪一个误差常数起作用。

**关键公式**：
$$
Kp=lim L(s),  Kv=lim sL(s),  Ka=lim s²L(s)
$$

**学习目标**：先确认单位反馈和系统型别，再按输入阶次选择误差常数。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

对单位负反馈且闭环稳定的标准模型，阶跃对应 Kp，单位斜坡对应 Kv，单位加速度输入 t²/2 对应 Ka。若误差通道、反馈传递函数或扰动入口改变，静态系数的定义也要随通道重写，不能只看对象名称。

### 教学计算/推理例

取 L(s)=10/s（Ⅰ型）：Kp=∞，Kv=10。单位阶跃的稳态误差为 0，单位斜坡的稳态误差为 1/10=0.1；抛物线输入则不能由 Ka（此处不存在有限 Ka）得到有限常值。

### 适用条件与边界

假设单位反馈、输入为标准多项式、闭环稳定且极限存在。无穷大系数表示相应理想稳态误差为零，不表示实际执行器可无限输出。

### 自检

1. Ⅰ型系统的 Kv=10 对单位斜坡误差是多少？
2. 为什么不能用 Kv 计算单位加速度输入的误差？

**核对要点**：为 0.1；输入阶次多一阶，需要 Ka 或直接分析误差通道。

### 关联节点

- **稳态误差**（出边，关系：相关）
- **终值定理法求稳态误差**（出边，关系：相关）
