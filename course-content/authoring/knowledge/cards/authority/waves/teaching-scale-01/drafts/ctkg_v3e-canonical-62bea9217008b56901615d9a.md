---
node_id: ctkg_v3e-canonical-62bea9217008b56901615d9a
authority_entity_id: "ctkg:v3e-canonical-62bea9217008b56901615d9a"
name: "单位斜坡函数"
name_en: "Unit-Ramp Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c33b309413d9dd157ef28302bf62c814faf2172121e7b6f7cee834dfc08b9c37.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c33b309413d9dd157ef28302bf62c814faf2172121e7b6f7cee834dfc08b9c37.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-62bea9217008b56901615d9a.md"
asset_refs: []
---

## 首页

# 单位斜坡函数 | Unit-Ramp Function

**一句话定义**：随时间以单位斜率增长的标准输入信号。

**核心直觉**：斜坡持续提出越来越高的目标，用来暴露系统的速度跟踪误差。

**关键公式**：
$$
r(t)=t1(t),  R(s)=1/s²
$$

**学习目标**：写出单位斜坡及其拉氏变换，并用误差通道计算跟踪偏差。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

单位斜坡在 t 秒处的目标值为 t，因此它测试的是系统对持续变化目标的跟随能力。对于简单一阶对象，输出可能比目标落后一个时间常数；对含积分器的闭环，稳态斜坡误差才可能是有限常数。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

通过 G(s)=1/(s+1) 的单位斜坡响应为 y(t)=t−1+e^(−t)。在 t=2 s 时，目标为 2、输出约 1.1353，瞬时误差约 0.8647。

### 适用条件与边界

需明确这是参考输入还是扰动，且系统与误差最终值存在。单位斜坡不等于任意速度的斜坡，幅值 A 应写成 At。

### 自检

1. t=3 s 时单位斜坡的目标值是多少？
2. 没有积分器的一阶闭环能否保证斜坡稳态误差为零？

**核对要点**：为 3；一般不能，低型别系统对斜坡误差会保持有限或增长。

### 关联节点

- **典型输入信号**（入边，关系：包含）
