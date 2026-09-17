---
node_id: ctkg_v3e-canonical-6461b91e08c647ceff0ceeee
authority_entity_id: "ctkg:v3e-canonical-6461b91e08c647ceff0ceeee"
name: "速度误差系数 (K_v)"
name_en: "Velocity Error Constant"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-3a322e7c50af009e1d0605f73f3261be527781f491f2317b0ea17b76567232ac.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-3a322e7c50af009e1d0605f73f3261be527781f491f2317b0ea17b76567232ac.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-6461b91e08c647ceff0ceeee.md"
asset_refs: []
---

## 首页

# 速度误差系数 (K_v) | Velocity Error Constant

**一句话定义**：Ⅰ型系统对单位斜坡输入的低频系数 Kv=lim sL(s)。

**核心直觉**：Kv 衡量系统跟随恒定速度目标的低频能力，越大时理想静差越小。

**关键公式**：
$$
Kv=lim(s→0)sL(s),  e_ss(ramp)=1/Kv
$$

**学习目标**：从环路低频展开得到 Kv，并确认单位反馈和闭环稳定。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

Kv 只适用于速度型输入的静态误差计算。若系统型别不足，Kv 可能为零，斜坡误差发散；若 Kv 无穷大，还要考虑执行器和模型误差是否允许这样的理想结论。

复核时还要把公式中的每个量与实际信号一一对应，检查单位是否一致、极限是否存在，并区分“该模型下算得出”与“工程上可以直接采用”。

### 教学计算/推理例

取 L(s)=10/[s(s+2)]，则 Kv=lim sL=10/2=5，单位斜坡稳态误差为 1/5=0.2。测速反馈或其他通道改变时，应对新的完整 L(s) 重算。

### 适用条件与边界

假设单位负反馈、标准单位斜坡、闭环稳定且误差终值存在。不要把 Kv 与控制器比例增益 Kp 混名。

### 自检

1. L(s)=10/[s(s+2)] 的 Kv 是多少？
2. 把对象增益翻倍，能否只凭 Kv 判断新的超调？

**核对要点**：为 5；不能，Kv只约束稳态斜坡误差，超调是动态指标。

### 关联节点

- **斜坡输入稳态误差**（入边，关系：相关）
- **特鲁克萨尔公式**（入边，关系：相关）
