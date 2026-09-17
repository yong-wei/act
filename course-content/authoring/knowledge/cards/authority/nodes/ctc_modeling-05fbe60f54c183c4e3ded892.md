---
node_id: ctc_modeling-05fbe60f54c183c4e3ded892
authority_entity_id: "ctc:modeling-05fbe60f54c183c4e3ded892"
name: "拉普拉斯反变换"
name_en: "Inverse Laplace Transform"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-556030d1b80c659d45a4ca07a8232281ab6525bb47ca29e3f7f00365617f1a97.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-556030d1b80c659d45a4ca07a8232281ab6525bb47ca29e3f7f00365617f1a97.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctc_modeling-05fbe60f54c183c4e3ded892.md"
asset_refs: []
---

## 首页

# 拉普拉斯反变换 | Inverse Laplace Transform

**一句话定义**：把复频域函数转换回时间域函数的运算。

**核心直觉**：先把 $s$ 域表达式拆成表中熟悉的基本项，再逐项还原时间变化。

**关键公式**：
$$
f(t)=\mathcal L^{-1}\{F(s)\}
$$

**学习目标**：从有理式识别基本拉氏对，并核对因果性和初始条件。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

反变换不是把符号逐个替换，而是寻找与 $F(s)$ 相同的标准结构。极点位置对应指数或振荡模态，重极点会带来 $t e^{pt}$ 等乘积项。若使用单边变换，初始条件会出现在微分性质中，不能在变换后悄悄丢掉。

### 教学计算/推理例

对 $F(s)=2/[s(s+2)]$ 做部分分式展开：$F(s)=1/s-1/(s+2)$，因此 $f(t)=1-e^{-2t}$。在 $t=1\ \mathrm{s}$ 时，$f(1)=1-e^{-2}\approx0.8647$。

### 适用条件与边界

例子采用因果信号和收敛域允许的拉氏变换。遇到重极点、非零初始状态或双边变换时，需补充相应条件。

### 自检

1. $F(s)=1/(s+3)$ 的时间函数是什么？
2. $2/[s(s+2)]$ 的终值能否直接从 $F(0)$ 读取？

**核对要点**：为 $e^{-3t}1(t)$；不能，先用终值定理或反变换，$F(0)$ 本身在含积分器时发散。

### 关联节点

- **一阶微分方程拉氏解法**（出边，关系：相关）
- **单边拉普拉斯变换**（出边，关系：相关）
