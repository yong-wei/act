---
node_id: ctkg_v3e-object-b542152b1fb2cbb25d81dbb2
authority_entity_id: "ctkg:v3e-object-b542152b1fb2cbb25d81dbb2"
name: "最小相位系统"
name_en: "Minimum-Phase System"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d3331475a83cf2ff3cc9910f186d8b8777bb0820c809e509017d6769df4b24ef.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d3331475a83cf2ff3cc9910f186d8b8777bb0820c809e509017d6769df4b24ef.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-26a/previous/ctkg_v3e-object-b542152b1fb2cbb25d81dbb2.md"
asset_refs: []
---

## 首页
# 最小相位系统 | Minimum-Phase System

一句话定义：在课程频率特性语境中，最小相位系统由约定的最小相位环节组成；分析稳定有理系统时，重点检查其有限零点是否位于左半平面。

- 使用定义时要说明稳定性、增益符号及原点边界约定。
- 最小相位不等于任意逆模型都能直接实现。
- 相同幅值的系统可能因全通因素而具有不同相位。

---
## 详情
### 完整解释

课程中的典型环节分类通常以正增益为基准，并包含积分、微分等原点边界环节。若讨论严格稳定的连续时间有理系统，可把“极点和有限零点都位于开左半平面、无额外延迟”等条件明确写出，避免将边界环节与严格稳定可逆性混在一起。

最小相位所强调的是零点位置及相位性质，不自动保证逆传递函数适当。稳定的严格真有理系统即使零点在左半平面，其逆也可能因分子次数更高而需要理想微分。逆是否稳定与逆是否因果、适当，是不同的检查项目。

### 教学计算/推理例

取稳定适当模型

$$
G_+(s)=\frac{1+0.5s}{(s+1)(0.2s+1)}.
$$

极点为 $-1,-5$，零点为 $-2$，直流增益为1。与它比较的 $G_-=(1-0.5s)/[(s+1)(0.2s+1)]$ 具有相同极点和幅值，但零点在 $+2$。

两者之比为

$$
\frac{G_-}{G_+}=\frac{1-0.5s}{1+0.5s}.
$$

这个稳定全通因子在虚轴上幅值为1，却增加 $-2\arctan(0.5\omega)$ 的相位。于是不能从幅值相同推出动态相同；在2 rad/s处，$G_-$ 相对于 $G_+$ 多出90度滞后。

$G_+$ 的逆为 $(s+1)(0.2s+1)/(1+0.5s)$，有限极点为 $-2$，却是不适当的二次分子/一次分母形式。因此“最小相位”不能替代完整逆实现检查。若以有限频段滤波近似逆，需要重新验证近似误差及控制性能。

### 适用条件与边界

原点积分环节 $1/s$ 在课程广义环节分类中可列入最小相位类，但其极点不在开左半平面，且不满足通常的BIBO稳定条件。不能把这种课程约定写成“所有极点严格为负”的例证。负增益会带来固定相位差，比较系统时也要统一符号基准。

具有时延的系统需要额外考虑非有理因素；理想延迟逆为时间超前，不能因有理部分的零点都稳定就宣称整体可因果精确求逆。内部隐藏模态同样需由实际实现核验，外部零极点约分不能替代内部稳定检查。

### 常见误区

1. 将最小相位系统定义成“只要没有右半平面极点”，漏查零点。
2. 认为左半平面零点就保证逆模型稳定、适当且可实时实现。
3. 不说明积分/微分边界约定，交替使用不同严格程度的定义。

### 自检

1. $G_+$ 与 $G_-$ 幅值相同，二者相位是否相同？
2. $G_+$ 的逆没有右半平面极点，为何仍不能直接当成普通适当滤波器？

**核对要点**：全通因子增加相位滞后；逆的分子次数高于分母，需要理想微分，适当性条件没有满足。

### 关联节点

- **非最小相位环节**（无向，关系：相关）
