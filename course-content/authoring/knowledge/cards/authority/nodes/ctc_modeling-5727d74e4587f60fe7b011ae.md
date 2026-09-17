---
node_id: ctc_modeling-5727d74e4587f60fe7b011ae
authority_entity_id: "ctc:modeling-5727d74e4587f60fe7b011ae"
name: "物理系统模型相似性"
name_en: "Similarity of Physical System Models"
category: 概念性
knowledge_type: C
bloom_level: 分析
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-059a39d04010d07a38c5b4fc111a6802286fb18c45ea3637878f7ca43d0ca9a7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-059a39d04010d07a38c5b4fc111a6802286fb18c45ea3637878f7ca43d0ca9a7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-5727d74e4587f60fe7b011ae.md"
asset_refs: []
---

## 首页

# 物理系统模型相似性 | Similarity of Physical System Models

**一句话定义**：不同物理系统在合适变量和尺度下可以满足同一形式的数学方程。

**核心直觉**：相似的是“关系的结构”，不是位移、电荷等物理量本身；无量纲化把单位差异暂时分离出来。

**关键公式**：
$$
z''+2z'+4z=1.
$$

**学习目标**：能从机械和电气方程完成尺度变换，并说明相同响应形状与不同物理单位之间的边界。

---

## 详情

### 完整解释

物理系统模型相似性是指不同的物理对象经过变量选择和尺度归一化后，呈现同一组微分关系。固定例包含机械系统的位移 $x$（米）和串联 RLC 电路的电荷 $q$（库仑）。机械参数为 $m=2\ \mathrm{kg}$、$c=4\ \mathrm{N\,s/m}$、$k=8\ \mathrm{N/m}$，施加 $F=2\ \mathrm{N}$ 的阶跃力，原方程为
$$
2\ddot x+4\dot x+8x=2.
$$
电路参数为 $L=0.5\ \mathrm{H}$、$R=1\ \Omega$、$C=0.5\ \mathrm{F}$，施加 $V=0.5\ \mathrm{V}$ 的阶跃电压，以电荷为变量时原方程为
$$
0.5\ddot q+1\dot q+\frac{q}{0.5}=0.5.
$$

分别定义无量纲坐标 $X=x/(1\ \mathrm{m})$、$Q=q/(1\ \mathrm{C})$ 和无量纲时间 $\tau=t/(1\ \mathrm{s})$。由于参考单位固定，导数 $d/d\tau$ 只表示对无量纲时间求导。机械方程除以 $2$、电路方程除以 $0.5$ 后都变成
$$
z''+2z'+4z=1,
$$
其中 $z$ 可以是 $X$ 或 $Q$。在零初态条件下，两者的归一化响应完全相同，极点为 $-1\pm j1.73205$。共同的无量纲终值为 $0.25$，还原到物理量则分别是 $x(\infty)=0.25\ \mathrm{m}$ 和 $q(\infty)=0.25\ \mathrm{C}$。

相似性因此提供一种迁移分析方法：可以先在一个熟悉的系统上理解二阶动态，再把结论映射到另一个系统。映射必须同时列出变量、参数、输入和单位；只看到方程系数相同而没有说明尺度，容易把形式相似误读成物理量相等。

### 教学计算/推理例

机械系统的静态平衡给出 $8x=2$，所以 $x(\infty)=0.25\ \mathrm{m}$；电路的直流平衡给出 $q/C=V$，所以 $q(\infty)=0.5\times0.5=0.25\ \mathrm{C}$。再用上述尺度归一化，两者的终值都是 $0.25$，但一个代表米，一个代表库仑。零初态下它们共享同一无量纲二阶响应，这就是可验证的相似性。

### 适用条件与边界

相同响应形状依赖给定参数、相同的参考尺度、同样的无量纲时间以及匹配的零初态。改变输入波形、初始状态、参数或寄生效应后，必须重新推导。无量纲坐标用于比较方程结构，不能替换物理量的单位和测量意义；本例的数值是教学设定，不代表某个真实机械装置或电路的测量结果。

### 常见误区

1. **误区**：两个系统的无量纲响应相同，所以位移就等于电荷。**纠正**：$X$ 与 $Q$ 是分别除以 $1\ \mathrm{m}$ 和 $1\ \mathrm{C}$ 得到的归一化坐标，物理单位和对象仍不同。
2. **误区**：方程形式相同就能在任意输入和初态下直接复用结论。**纠正**：还要匹配尺度、时间变量、输入幅值和初始条件，并检查被忽略的物理效应。

### 自检

1. 为什么机械方程除以 $2$、电路方程除以 $0.5$ 后会得到同一个右端为 $1$ 的方程？
2. 无量纲终值都是 $0.25$ 时，两个物理系统的终值分别是什么？

**核对要点**：机械方程除以质量 $2$，电路方程除以电感 $0.5$，得到相同的系数 $2,4,1$；物理终值分别为 $0.25$ 米和 $0.25$ 库仑，数值相同不代表单位相同。

### 关联节点

- **相似物理系统**（无向，关系：相关）
