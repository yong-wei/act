---
node_id: ctkg_v3e-canonical-ad988c74286cfcad2c3fdf98
authority_entity_id: "ctkg:v3e-canonical-ad988c74286cfcad2c3fdf98"
name: "欠阻尼"
name_en: "Underdamping Range"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-40314d516f236cc20ff13d39a138b4d2dafa99fcb4484ea3276844a7704552cf.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-40314d516f236cc20ff13d39a138b4d2dafa99fcb4484ea3276844a7704552cf.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-11a/previous/ctkg_v3e-canonical-ad988c74286cfcad2c3fdf98.md"
asset_refs: []
---

## 首页

# 欠阻尼 | Underdamping Range

**一句话定义**：在稳定标准二阶模型中，欠阻尼对应 $0<\zeta<1$，其特征根具有负实部和非零虚部。

**核心直觉**：复根说明存在振荡形式，实部符号才决定这种振荡衰减、持续还是增长。

**关键公式**：$s=-\zeta\omega_n\pm j\omega_n\sqrt{1-\zeta^2}$。

**学习目标**：检查欠阻尼条件与边界，避免把所有共轭复根都当作稳定衰减振荡。

---

## 详情

### 完整解释

欠阻尼范围的两个不等式分别承担作用。$\zeta<1$ 使标准二阶根带有非零虚部，而 $\zeta>0$ 使实部为负。只检查前一个条件，会把无阻尼边界或负阻尼增长振荡也混入稳定欠阻尼结论。

本卡将“欠阻尼”限定为常用稳定标准二阶情形，以便与同批的欠阻尼系统计算例一致。对于更一般的参数或高阶系统，应直接检查特征根和实际响应通道，不能用一个标签代替完整判断。

### 教学计算/推理例

固定归一化固有频率 $\omega_n=2$。当 $\zeta=0.5$ 时，特征式为 $s^2+2s+4$，极点
$$
s=-1\pm j\sqrt3.
$$
振荡项带有 $e^{-t}$ 包络，随时间衰减。这符合 $0<\zeta<1$ 的稳定欠阻尼范围。

在边界 $\zeta=0$，特征式变为 $s^2+4$，极点为 $\pm2j$。虚部仍非零，但实部为零，理想自由振荡不衰减。因此它属于无阻尼边界，不能继续使用“逐渐消失”的描述。

若取 $\zeta=-0.5$，特征式为 $s^2-2s+4$，极点为
$$
s=1\pm j\sqrt3.
$$
仍有共轭复根，但对应的指数因子增长而不是衰减。负阻尼反例说明，看到图上两点离开实轴并不足以证明稳定欠阻尼。

### 适用条件与边界

本例只改变阻尼比，固有频率和标准结构固定。实际系统中复极点可能受到零点约消、输出不可观测或其他模态影响；某对复根的存在不必在任意输出里表现为明显振荡。阶跃超调公式也要求相应的标准通道、零初态和稳定参数范围。

接近边界时，参数误差会显著影响长期判断。数学上严格等于零与很小的正阻尼不同，不能把数值上“接近虚轴”直接解释成已经确认无阻尼。

### 常见误区

1. **误区**：只要 $\zeta<1$ 就一定衰减振荡。**纠正**：还要检查 $\zeta>0$。
2. **误区**：共轭复根一定在左半平面。**纠正**：本例负阻尼产生右半平面的共轭复根。

### 自检

1. $\zeta=0$ 为什么不能说成渐近衰减？
2. $\zeta=-0.5$ 与 $0.5$ 的关键差异是什么？

**核对要点**：零阻尼实部为零；两例实部符号相反，分别导致增长与衰减。

### 关联节点

- **欠阻尼系统**（无向，关系：相关）
