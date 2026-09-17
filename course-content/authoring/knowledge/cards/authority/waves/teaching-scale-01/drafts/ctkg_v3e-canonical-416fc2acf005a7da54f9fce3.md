---
node_id: ctkg_v3e-canonical-416fc2acf005a7da54f9fce3
authority_entity_id: "ctkg:v3e-canonical-416fc2acf005a7da54f9fce3"
name: "位置误差常数 (K_p)"
name_en: "Position Error Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-96e87fa5acebbc3d3475a668c25db542a475ab27630dff585876632beefcd8da.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-96e87fa5acebbc3d3475a668c25db542a475ab27630dff585876632beefcd8da.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-416fc2acf005a7da54f9fce3.md"
asset_refs: []
---

## 首页

# 位置误差常数 (K_p) | Position Error Constant

**一句话定义**：Ⅰ型别判定语境下，环路低频增益 Kp=lim L(s)，决定单位阶跃的静差。

**核心直觉**：Kp 是对低频“位置”输入的放大能力，反馈越强，阶跃残差通常越小。

**关键公式**：
$$
Kp=lim(s→0)L(s),  e_ss=1/(1+Kp)
$$

**学习目标**：计算单位反馈的 Kp，并说明 Kp 有限、无穷大和不稳定三种边界。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

Kp 只描述单位阶跃跟踪的低频系数。若环路含积分器，Kp 可能为无穷大，对稳定的单位阶跃可得到零静差；但积分器也会改变动态和饱和风险。不能把 Kp 当成控制器的比例参数名称。

复核时还要把公式中的每个量与实际信号一一对应，检查单位是否一致、极限是否存在，并区分“该模型下算得出”与“工程上可以直接采用”。

### 教学计算/推理例

取 L(s)=4/(s+2)，则 Kp=L(0)=2，单位阶跃误差 e_ss=1/(1+2)=1/3。若把 L 改为 4/s，Kp 发散，需先确认闭环稳定后才可说理想静差为零。

### 适用条件与边界

假设单位负反馈、闭环稳定、参考为单位阶跃且最终值存在。非单位反馈应使用完整误差传递函数。

### 自检

1. L(s)=4/(s+2) 的 Kp 是多少？
2. Kp=∞ 时是否自动表示闭环稳定？

**核对要点**：为 2；不表示，稳定性仍需由闭环极点或判据检查。

### 关联节点

- **零型系统**（入边，关系：相关）
