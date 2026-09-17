---
node_id: ctc_modeling-aa10e4daa1e969c557f6ef83
authority_entity_id: "ctc:modeling-aa10e4daa1e969c557f6ef83"
name: "复频域传递函数"
name_en: "Complex-Frequency-Domain Transfer Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-11d7e80e55811769be8a223e7f7f0d9686be8db0e47c1503c2cd499ad577d7a1.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-11d7e80e55811769be8a223e7f7f0d9686be8db0e47c1503c2cd499ad577d7a1.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctc_modeling-aa10e4daa1e969c557f6ef83.md"
asset_refs: []
---

## 首页

# 复频域传递函数 | Complex-Frequency-Domain Transfer Function

**一句话定义**：用复变量 $s$ 表示输入输出关系，极点和零点为动态分析提供统一坐标。

**核心直觉**：把时间微分变成 $s$ 的代数乘法，复杂动态就能用极点零点和代数运算阅读。

**关键公式**：
$$
G(s)=\frac{Y(s)}{U(s)}\quad\text{(zero initial conditions)}
$$

**学习目标**：在零初始条件下从输入输出拉氏变换得到 $G(s)$，并用极点判断自然模态。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

复频域传递函数是传递函数在 $s=\sigma+j\omega$ 平面上的表示。分母根给出系统自然模态，分子根影响通道的幅相和瞬态形状；它适合线性定常系统的输入输出分析。它不保存任意初始状态，也不自动描述非线性或时变行为。

### 教学计算/推理例

取 $G(s)=5/(s+2)$。极点为 $s=-2$，单位阶跃终值为 $G(0)=2.5$，时间常数为 $1/2=0.5\ \mathrm{s}$。在 $t=0.5\ \mathrm{s}$ 时，$y=2.5(1-e^{-1})\approx1.5803$。

### 适用条件与边界

必须说明零初始条件、输入输出通道和线性定常假设。非零初始响应要另加自由响应；极点零点发生精确消去时还需检查内部稳定性。

### 自检

1. 把 $s$ 直接替换成 $j\omega$ 后得到的是什么？
2. 零初始条件是否意味着系统没有动态？

**核对要点**：得到频率响应 $G(j\omega)$；不是，只是传递函数定义时没有把自由响应混入输入输出比。

### 关联节点

- **传递函数**（出边，关系：相关）
- **复频域传递函数极点**（出边，关系：相关）
