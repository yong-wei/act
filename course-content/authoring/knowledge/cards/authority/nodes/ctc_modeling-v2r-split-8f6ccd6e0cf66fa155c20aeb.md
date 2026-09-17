---
node_id: ctc_modeling-v2r-split-8f6ccd6e0cf66fa155c20aeb
authority_entity_id: "ctc:modeling-v2r-split-8f6ccd6e0cf66fa155c20aeb"
name: "复频域传递函数极点"
name_en: "Transfer-Function Poles in the Complex Frequency Domain"
category: 概念性
knowledge_type: C
bloom_level: 理解
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-95f35baa142e7bb2cdd9e8aed64d48f62c816ae28a77a7c8346ce02dbb59f183.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-95f35baa142e7bb2cdd9e8aed64d48f62c816ae28a77a7c8346ce02dbb59f183.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-08a/previous/ctc_modeling-v2r-split-8f6ccd6e0cf66fa155c20aeb.md"
asset_refs: []
---

## 首页

# 复频域传递函数极点 | Transfer-Function Poles in the Complex Frequency Domain

**一句话定义**：约简传递函数分母为零的复频域位置。

**核心直觉**：极点的实部控制模态衰减，虚部控制振荡角频率。

**关键公式**：$G(s)=\dfrac{2}{s^2+2s+2}$ 的极点为 $s=-1\pm j$。

**学习目标**：从约简分母识别复极点，并将极点位置连接到时域模态。

---

## 详情

### 完整解释

传递函数的极点是约简后分母多项式的根。在 $s=\sigma+j\omega$ 平面上，极点位置同时携带衰减和振荡信息：左半平面的负实部让模态衰减，虚部的绝对值给出振荡角频率。对实系数模型，非实极点成共轭对出现。

极点是传递函数的输入输出特征。若分子和分母存在公共因子，应先约简；被约去的因子不再算作该约简传递函数的极点。内部状态仍可能有隐藏模态，那属于另一张卡讨论的边界，不能与最小实现的传递函数极点混为一谈。

读极点时要同时保留“位置”和“对应通道”两层语义。实部相同而虚部不同的极点，衰减包络可以相同但振荡节奏不同；虚部为零的实极点则不产生这种正弦振荡。极点列表本身也不提供输入幅值或初始状态，时域响应还要结合分子、输入和初始条件读取。

### 教学计算/推理例

固定最小实现为
$$
G(s)=\frac{2}{s^2+2s+2}。
$$
分母根为
$$
s=-1\pm j。
$$
因此单位冲激响应为
$$
h(t)=2e^{-t}\sin(t),\qquad t\ge0，
$$
单位阶跃输出的绝对量为
$$
y(t)=1-e^{-t}[\cos(t)+\sin(t)]。
$$
在这里，实部 $-1$ 决定包络 $e^{-t}$ 的衰减速度，虚部的绝对值 $1$ 决定振荡的角频率。$y(t)$ 是输入为单位阶跃时的完整输出，不应把它写成没有定义基准的“增量响应”。

### 适用条件与边界

上述解释针对约简的有理传递函数和最小实现。极点位置可以帮助判断自然响应与 BIBO 稳定性，但不能单独替代对内部状态、输入约束或非最小实现的检查。若有可去公共因子，必须先约简后再列出传递函数极点。

### 常见误区

1. **误区**：看到分母中任意出现的因子都可直接列为极点。**纠正**：先约去分子分母公共因子，再讨论约简传递函数的极点。
2. **误区**：复极点的虚部决定衰减速度，实部决定振荡频率。**纠正**：本例中实部 $-1$ 决定衰减，虚部的绝对值为 $1$，对应本例的模态振荡角频率。

### 自检

1. 本例的两个极点是什么？
2. 如果只看 $-1$ 而忽略虚部，会漏掉哪种响应信息？

**核对要点**：极点为 $-1\pm j$；忽略虚部会漏掉振荡角频率，仍只能知道包络的衰减趋势。

### 关联节点

- **闭环特征极点**（出边，关系：前置于）
- **开环极点**（出边，关系：前置于）
- **传递函数零点**（无向，关系：相关）
- **s平面**（无向，关系：相关）
- **传递函数极点**（无向，关系：相关）
- **极点删除法**（无向，关系：相关）
- **复频域传递函数**（无向，关系：相关）
- **使用根从分母多项式计算极点**（无向，关系：相关）
- **复频域s平面**（无向，关系：相关）
- **忽略次要极点降阶法**（无向，关系：相关）
- **系统特征极点**（无向，关系：相关）
- **传递函数**（出边，关系：推导自）
- **开环分母多项式极点**（入边，关系：属于）
- **开环极点**（入边，关系：属于）
- **出射角**（无向，关系：相关）
- **开环传递函数零点**（无向，关系：相关）
- **根轨迹法**（入边，关系：用于分析）
- **闭环特征极点**（入边，关系：属于）
- **有界输入有界输出稳定性**（无向，关系：相关）
