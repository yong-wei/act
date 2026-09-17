---
node_id: ctkg_v3e-object-6592690fdccf416b0340917b
authority_entity_id: "ctkg:v3e-object-6592690fdccf416b0340917b"
name: "带宽频率"
name_en: "Bandwidth Frequency"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-022a6a8f86aa91d0afea6ea02905fb70da8314fff0c64090da2983ba104dccb7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-022a6a8f86aa91d0afea6ea02905fb70da8314fff0c64090da2983ba104dccb7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-25a/previous/ctkg_v3e-object-6592690fdccf416b0340917b.md"
asset_refs: []
---

## 首页
# 带宽频率 | Bandwidth Frequency

一句话定义：带宽频率是指定通道幅频响应达到约定通带边界阈值时的频率，常用符号 $\omega_b$。

- 先声明阈值相对哪个基准。
- 常见低通约定是相对直流幅值下降约3 dB。
- 它不同于环路单位增益交越频率和单个因子的转折频率。

---
## 详情
### 完整解释

对稳定低通闭环通道 $T(s)$，若 $T(0)$ 有限且非零，常见定义为 $|T(j\omega_b)|=|T(0)|/\sqrt2$。等价的分贝条件是带宽处电平比直流电平低3.0103 dB。某些任务采用不同允许误差阈值，必须把该约定写出，不能只给出一个没有定义的频率数。

一条幅频曲线可能有峰值或多次越过阈值。通常应按从低频通带向高频下降的边界选择，并说明任何多交点情况。对简单一阶低通，幅值单调下降，阈值点唯一；高阶系统则应核验曲线，不能预先假定。

### 教学计算/推理例

令单位负反馈开环环路为 $L=2/(s+1)$，则闭环参考通道为 $T=L/(1+L)=2/(s+3)$。直流幅值为 $2/3$。按闭环相对阈值计算：

$$
\frac{|T(j\omega_b)|}{2/3}=\frac3{\sqrt{9+\omega_b^2}}=\frac1{\sqrt2},
$$

所以闭环带宽频率为3 rad/s。开环单位增益交越则满足 $2/\sqrt{1+\omega_c^2}=1$，得到 $\omega_c=\sqrt3\approx1.7321$ rad/s。开环一阶因子的转折频率为1 rad/s。

三个结果对应不同问题：1是开环因子的渐近线交接位置，1.7321是开环幅值等于1的位置，3是闭环幅值相对其直流值下降到阈值的位置。它们在某些设计中可能接近，但没有一般的恒等关系。改变环路增益后，因子的转折位置可保持不变，而交越频率和闭环带宽会变化。

### 适用条件与边界

带宽频率通常以rad/s表示；如改成Hz，需除以 $2\pi$。本例3 rad/s约为0.4775 Hz。若将幅频数据从一种单位重标到另一种单位，应同时修改轴标签，不能仅替换单位文字。

本例闭环稳定，能够用频率响应描述渐近正弦响应。不稳定系统、带通系统或零直流增益通道需要重新说明适用的边界定义。即便带宽已算出，时域超调、相位滞后与执行器限制仍未被一个阈值频率完整覆盖。

### 常见误区

1. 把三个不同频率都简称“截止”，然后在计算中互换。
2. 对非单位直流增益直接求 $|T|=1/\sqrt2$，遗漏归一化。
3. 认为带宽外输出立即消失，或带宽内完全无失真。

### 自检

1. 本例带宽阈值的绝对幅值是多少？
2. 开环转折频率1 rad/s能否直接作为闭环带宽？

**核对要点**：为 $2/(3\sqrt2)$；不能，闭环相对阈值给出3 rad/s，所分析的传递通道和条件均不同。

### 关联节点

- **谐振频率**（无向，关系：相关）
- **截止频率**（无向，关系：相关）
- **谐振峰值**（无向，关系：相关）
