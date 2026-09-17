---
node_id: ctkg_v3e-canonical-0e5d22ed0afee37f65584d36
authority_entity_id: "ctkg:v3e-canonical-0e5d22ed0afee37f65584d36"
name: "正弦函数"
name_en: "Sinusoidal Function"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-d8a3f4c75e9a69c41635c917e02fcc42d7e0801c3e13e82b85a1b2e7e4c6c055.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-d8a3f4c75e9a69c41635c917e02fcc42d7e0801c3e13e82b85a1b2e7e4c6c055.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-10a/previous/ctkg_v3e-canonical-0e5d22ed0afee37f65584d36.md"
asset_refs: []
---

## 首页

# 正弦函数 | Sinusoidal Function

**一句话定义**：正弦函数用幅值、角频率和相位描述周期变化，常用形式为 $A\sin(\omega t+\varphi)$。

**核心直觉**：幅值决定变化范围，角频率决定相位推进速度，相位决定从周期的哪个位置开始。

**关键公式**：$T=2\pi/\omega$，$f=\omega/(2\pi)$。

**学习目标**：区分角频率与普通频率，正确处理相位单位和因果正弦信号的初始值。

---

## 详情

### 完整解释

正弦信号的自变量是无量纲角度。若使用弧度，$\omega t$ 和 $\varphi$ 都要按同一角度约定相加。角频率描述单位时间相位前进多少弧度，而普通频率描述单位时间完成多少周期，所以二者相差 $2\pi$，不是两个可随意互换的名称。

相位还决定时间原点处的值。正弦函数不一定从零开始，只有特定相位才使初始值为零。讨论输入从 $t=0$ 开始施加时，应明确它是此前为零的因果信号，还是从更早时间一直存在的周期信号；这会影响拉普拉斯描述和系统瞬态。

### 教学计算/推理例

采用归一化时间，在 $t\ge0$ 施加
$$
r(t)=2\sin(3t+\pi/6),
$$
此前输入为零。幅值为 2，角频率为 3，相位为 $\pi/6$。周期为 $2\pi/3$，普通频率为 $3/(2\pi)$ 个周期每单位时间。若一个归一化时间单位取一秒，便对应通常的弧度每秒和赫兹单位。

输入刚接通时
$$
r(0^+)=2\sin(\pi/6)=1.
$$
因此这个因果正弦并非从零值开始。对 $\operatorname{Re}s>0$，其拉普拉斯变换为
$$
R(s)=\frac{2[s\sin(\pi/6)+3\cos(\pi/6)]}{s^2+9}
=\frac{s+3\sqrt3}{s^2+9}.
$$
分子中同时有 $s$ 项和常数项，是相位不为零的结果。直接把变换写成无相位的 $6/(s^2+9)$ 会描述另一个输入，不能用于本例。

### 适用条件与边界

理想正弦是分析频率响应的基础信号，但有限时间接通时通常还会激发系统瞬态。正弦稳态响应与从接通瞬间起的完整响应不是同一个对象。幅值和相位单位也要与测量信号一致；例如角度用度测得的相位，代入采用弧度的三角表达式前要先转换。本例只定义输入，不对某个未知对象的输出幅相作推断。

### 常见误区

1. **误区**：本例频率是每单位时间 3 个周期。**纠正**：3 是角频率，普通频率为 $3/(2\pi)$。
2. **误区**：正弦输入在 $t=0$ 总为零。**纠正**：本例有相位，初始右值为 1。

### 自检

1. 本例相位为什么必须与 $3t$ 使用同一角度单位？
2. 因果变换的分子为什么含有 $s$？

**核对要点**：两者在同一个正弦自变量中相加；非零相位带来余弦分量，其变换产生 $s$ 项。

### 关联节点

- **典型输入信号**（入边，关系：包含组件）
