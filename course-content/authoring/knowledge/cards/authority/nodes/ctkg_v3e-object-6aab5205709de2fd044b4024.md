---
node_id: ctkg_v3e-object-6aab5205709de2fd044b4024
authority_entity_id: "ctkg:v3e-object-6aab5205709de2fd044b4024"
name: "奈奎斯特稳定判据（奈氏判据）"
name_en: "Nyquist Stability Criterion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-59effbaf824a3ac144be0debcdb6de56d4993c0f3053bea033ba25756fdfd62c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-59effbaf824a3ac144be0debcdb6de56d4993c0f3053bea033ba25756fdfd62c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-26a/previous/ctkg_v3e-object-6aab5205709de2fd044b4024.md"
asset_refs: []
---

## 首页
# 奈奎斯特稳定判据（奈氏判据） | Nyquist Stability Criterion

一句话定义：奈氏判据把开环右半平面极点数与完整频率围线对临界点 $-1$ 的绕行联系起来，判断单位负反馈闭环的稳定性。

- 必须同时声明原围线方向与映射绕行计数方向。
- 正频率半支不能直接冒充完整Nyquist曲线。
- 不经过临界点只是条件之一，仍须核对圈数。

---
## 详情
### 完整解释

设环路为 $L(s)$，单位负反馈特征条件为 $1+L(s)=0$。取包围右半平面的顺时针闭合围线：沿虚轴从 $-jR$ 向 $+jR$，再沿右半圆返回，最后令 $R$ 趋于无穷。先讨论围线上没有极点或零点的情形。

记 $P$ 为 $L$ 在右半平面的极点数，$Z$ 为 $1+L$ 在右半平面的零点数，均计重数。若把 $L$ 的完整映射绕 $-1$ 的逆时针净圈数记为 $N_{ccw}$，辐角原理给出

$$
N_{ccw}=P-Z,\qquad Z=P-N_{ccw}.
$$

因此在没有闭环虚轴根、没有隐藏不稳定相消且特征方程对应实际闭环的条件下，渐近稳定要求 $Z=0$，即 $N_{ccw}=P$。若采用顺时针为正的映射计数，公式符号相反；不能从不同约定中各取一半。

### 教学计算/推理例

取 $L=K/(s-1)$，$K>0$，开环有一个右半平面极点，故 $P=1$。闭环极点由 $s-1+K=0$ 得到 $s=1-K$。这可作为频域计数的独立核验。

当 $K=0.5$，完整映射不绕 $-1$，故 $N_{ccw}=0$，算得 $Z=1$；闭环极点为0.5，不稳定。当 $K=2$，映射逆时针包围 $-1$ 一圈，故 $N_{ccw}=1$，算得 $Z=0$；闭环极点为 $-1$，稳定。

当 $K=1$，$L(j0)=-1$，曲线经过临界点，闭环极点位于原点。此时不能继续把它归入不穿越临界点的严格稳定情形。这个例子说明：对于开环不稳定对象，“不包围 $-1$”反而不能满足稳定所需计数。

### 适用条件与边界

若开环在虚轴上有极点，原围线必须用小半圆绕避，并把绕避弧的映射纳入完整计数；直接略去该频率是不完整的。实系数模型的负频率部分可由正频率共轭得到，但方向和无穷远闭合部分仍要说明。

某些教材使用半闭合曲线或穿越计数的等价表达，必须配合对应构造与方向使用。本卡采用明确的完整围线约定，避免把正频率图中的局部形状直接当成总圈数。内部稳定性还需排除被外部约分隐藏的右半平面模态。

### 常见误区

1. 不数开环右半平面极点，只看是否包围临界点。
2. 原围线采用顺时针，映射圈数却套用另一套符号公式。
3. 只画正频率半支，就宣称已完成闭合曲线的绕行计数。

### 自检

1. 本例 $P=1$，闭环稳定时需要多少逆时针净圈数？
2. 曲线经过 $-1$ 时能否直接使用上述严格稳定判断？

**核对要点**：需要1圈；穿过临界点对应边界特征根，须单独处理，不能称为渐近稳定。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
