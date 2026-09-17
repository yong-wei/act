---
node_id: ctkg_v3e-object-5a7582dcb72b1d33d09ca641
authority_entity_id: "ctkg:v3e-object-5a7582dcb72b1d33d09ca641"
name: "非最小相位环节"
name_en: "Nonminimum-Phase Element"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f9ddeee9b96a82a6e775023e207dcac12f82aac737156c6020ffe8f44971e2f7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f9ddeee9b96a82a6e775023e207dcac12f82aac737156c6020ffe8f44971e2f7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-26a/previous/ctkg_v3e-object-5a7582dcb72b1d33d09ca641.md"
asset_refs: []
---

## 首页
# 非最小相位环节 | Nonminimum-Phase Element

一句话定义：在课程典型环节分类中，具有额外相位变化的负增益、右半平面零点或不稳定极点等环节归入非最小相位环节，需说明所用约定。

- 相同幅值不保证相同相位。
- 右半平面零点与右半平面极点的稳定性作用不同。
- 负增益的分类还包含符号基准，不能只靠有限零极点位置解释。

---
## 详情
### 完整解释

课程频率特性章节常以正增益和常见稳定典型环节为比较基准，把负比例、不稳定惯性以及右半平面零点等因素归入非最小相位类。这个教学分类有助于提醒：幅频形状相同的因子，仍可能带来不同的相位，不能仅凭幅频曲线恢复全部动态。

使用术语时要区分原因。右半平面极点对应不稳定自然模态；右半平面零点则可能存在于一个极点全部稳定的系统中。负常数 $-1$ 没有有限零点或极点，但相对于正常数1有180度相位差，因而来源中的负比例分类依赖明确的符号基准，不能声称它必然含右半平面有限根。

### 教学计算/推理例

比较 $F_+=1+0.5s$ 和 $F_-=1-0.5s$。它们的零点分别为 $-2$ 与 $+2$，在正频率上都具有幅值 $\sqrt{1+0.25\omega^2}$。但相位分别为 $+\arctan(0.5\omega)$ 与 $-\arctan(0.5\omega)$。

在 $\omega=2$ rad/s，幅值都为 $\sqrt2$，相位却分别为45度与负45度。右半平面零点一侧相对于左半平面零点多出90度滞后。这两个理想零点因子本身为不适当传递函数，不应单独描述成可直接实现的滤波器；可以把它们放入适当的完整模型比较。

例如

$$
G_\pm(s)=\frac{1\pm0.5s}{(s+1)(0.2s+1)}.
$$

两个模型极点均为 $-1,-5$，都稳定，幅值仍完全相同。负号模型有右半平面零点，因此是稳定但非最小相位的例子。这直接反驳“非最小相位就一定不稳定”的误解。

### 适用条件与边界

还可比较 $1/(s+1)$ 与 $1/(s-1)$：两者在虚轴上的幅值相同，但后一环节有右半平面极点，不能期待任意初态下的响应衰减。判断稳定性应看极点和内部实现，判断零点造成的额外相位约束则需另作分析。

纯延迟幅值为1，具有随频率增长的相位滞后，其逆需要时间超前，不能因没有有限零极点就忽略它。实际系统还应检查相消和实现方式；约分后的外部传递函数可能掩盖内部不稳定状态。

### 常见误区

1. 把右半平面零点与极点都解释为不稳定自由响应。
2. 仅从幅频曲线断定环节的相位特性。
3. 用“所有非最小相位环节都有右半平面有限根”解释负常数和延迟。

### 自检

1. $G_-$ 的极点均为负，为什么仍是非最小相位例子？
2. $-1$ 的额外相位是否来自某个右半平面有限极点？

**核对要点**：因为它有零点 $+2$，与自然模态稳定性是不同问题；负常数没有这种极点，其分类需说明相对于正增益的符号约定。

### 关联节点

- **最小相位系统**（无向，关系：相关）
- **最小相位环节**（无向，关系：相关）
- **非最小相位系统**（无向，关系：相关）
