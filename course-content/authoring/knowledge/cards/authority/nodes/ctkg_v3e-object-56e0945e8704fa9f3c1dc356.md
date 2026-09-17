---
node_id: ctkg_v3e-object-56e0945e8704fa9f3c1dc356
authority_entity_id: "ctkg:v3e-object-56e0945e8704fa9f3c1dc356"
name: "低频段"
name_en: "Low-Frequency Region"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e05f838860bfc8fc1b3a234d0a2d7aba58fa4b262cf0fa4fb89c2a0b1d286662.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e05f838860bfc8fc1b3a234d0a2d7aba58fa4b262cf0fa4fb89c2a0b1d286662.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-25a/previous/ctkg_v3e-object-56e0945e8704fa9f3c1dc356.md"
asset_refs: []
---

## 首页
# 低频段 | Low-Frequency Region

一句话定义：在分解典型环节的伯德图构造中，低于最小有限正交接频率的范围通常称为低频段。

- 低频是相对于系统转折频率而言的。
- 积分环节可能使低频幅值仍随频率明显变化。
- 低频段边界不是所有近似自动达到高精度的保证。

---
## 详情
### 完整解释

将环路传递函数分解为增益、原点零极点及具有有限时间常数的典型环节后，可按有限正交接频率排序。若最小值为 $\omega_{\min}$，则 $0<\omega<\omega_{\min}$ 是常用的低频段划分。这种划分帮助决定哪些因子可用其低频渐近形式代替。

例如惯性因子 $1/(1+Ts)$ 在 $\omega T\ll1$ 时幅值接近1，但积分因子 $1/s$ 在任何频率都不能替换成常数，其幅值为 $1/\omega$。因此低频段不必是一条水平线。原点极点没有有限正交接频率，排序时不能把它当成普通的 $1/T$ 转折点。

### 教学计算/推理例

取环路

$$
L(s)=\frac{10(1+s/10)}{s(1+s)}.
$$

有限正交接频率为1和10 rad/s，最小值为1。在远低于1的频率处，零极点因子 $1+j\omega/10$ 和 $1+j\omega$ 都接近1，故 $L(j\omega)\approx10/(j\omega)$。低频幅值渐近线为

$$
20\log_{10}|L(j\omega)|\approx20-20\log_{10}\omega,
$$

斜率为 $-20$ dB/dec，相位趋近 $-90^\circ$。在0.1 rad/s处，渐近幅值为40 dB，精确值为约39.9572 dB，两者相差约0.0428 dB。

当频率接近1时，惯性因子的偏差开始明显；虽然仍可说处于低频段的边缘，却不能认为所有低频近似都足够精确。“频率小于1”与“频率远小于1”代表不同强度的条件，允许误差较小时应计算精确值。

### 适用条件与边界

低频段划分是特定传递函数的表达工具，不是脱离系统尺度的固定Hz范围。不同系统的最小交接频率不同，相同的1 rad/s可能分别属于低频、中频或高频。若系统只有原点因子和常数，没有有限正交接频率，上述分段定义不能机械使用。

闭环精度常与低频环路增益有关，但不能仅凭低频幅值很大就保证整个闭环稳定。应同时检查相位、交越附近行为以及完整稳定条件。对非单位反馈和含传感器偏置的系统，低频高增益也不自动保证真实输出没有偏差。

### 常见误区

1. 把所有系统低频段都画成水平线，遗漏积分或原点零点。
2. 将最小交接频率当成绝对频率标准，未说明分析对象。
3. 把区间分类当成近似误差承诺，在边界附近仍用粗略渐近值。

### 自检

1. 本例低频幅值渐近斜率为何不是0？
2. 原点积分环节是否给出一个有限正的交接频率？

**核对要点**：环路含 $1/s$，幅值随频率反比变化；积分环节的原点极点不对应普通有限时间常数的正交接频率。

### 关联节点

- **对数幅频渐近特性曲线**（出边，关系：适用于）
