---
node_id: ctc_modeling-b2fd214ec64665147e16ff9d
authority_entity_id: "ctc:modeling-b2fd214ec64665147e16ff9d"
name: "运算放大器积分器"
name_en: "Operational-Amplifier Integrator"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-042b449fb0a2d6dd5165847598c8c1cbebf4af681017b66a0a57847394794ece.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-042b449fb0a2d6dd5165847598c8c1cbebf4af681017b66a0a57847394794ece.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctc_modeling-b2fd214ec64665147e16ff9d.md"
asset_refs: []
---

## 首页

# 运算放大器积分器 | Operational-Amplifier Integrator

**一句话定义**：用运算放大器、电阻和反馈电容实现输入积分关系的环节。

**核心直觉**：电容把电流累积成电荷，输出因此持续记录输入的时间积分。

**关键公式**：
$$
G(s)=\frac{V_o(s)}{V_i(s)}=-\frac{1}{RCs}
$$

**学习目标**：计算理想积分器的斜率和时间常数，并检查饱和与初始电荷。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

理想反相运算放大器积分器满足 $v_o(t)=-[RC]^{-1}\int v_i(t)\,dt+v_o(0)$。它有一个原点极点，因此对恒定输入会产生持续斜坡，实际电路最终会受输出电源、偏置和漏电限制。这个电路实现的是环节关系，不能把理想无限积分当成设备长期行为。

### 教学计算/推理例

取 $R=100\,\mathrm{k\Omega}$、$C=10\,\mu\mathrm F$，则 $RC=1\,\mathrm s$。从零初值施加 $0.2\,\mathrm V$ 阶跃，理想输出斜率为 $-0.2\,\mathrm V/s$；$3\,\mathrm s$ 后为 $-0.6\,\mathrm V$，前提是尚未饱和。

### 适用条件与边界

适用理想运放、线性输出范围、给定电容初值和足够的带宽。低频漂移、饱和和抗饱和复位会改变实际积分行为。

### 自检

1. 把 $R$ 加倍而 $C$ 不变，单位阶跃输出斜率如何变化？
2. 积分器输出长期一定保持线性下降吗？

**核对要点**：斜率减半；不一定，实际输出会受到饱和、偏置和复位影响。

### 关联节点

- 当前权威邻域仅返回该节点本身，未添加推测关系。
