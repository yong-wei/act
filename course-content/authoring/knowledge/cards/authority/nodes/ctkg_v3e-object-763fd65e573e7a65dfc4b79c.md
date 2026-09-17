---
node_id: ctkg_v3e-object-763fd65e573e7a65dfc4b79c
authority_entity_id: "ctkg:v3e-object-763fd65e573e7a65dfc4b79c"
name: "奈奎斯特图"
name_en: "Nyquist Plot"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8d9ae91f163ef1f36530a062a095d926c1d9b7e92194c8880ee306559a5bcfcc.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8d9ae91f163ef1f36530a062a095d926c1d9b7e92194c8880ee306559a5bcfcc.json
  - course-content/authoring/knowledge/cards/nodes/奈奎斯特稳定判据_5_a1b34560.md
asset_refs: []
---

## 首页

# 奈奎斯特图 | Nyquist Plot

**一句话定义**：将指定复平面围线经环路传递函数映射后，在复平面上形成的曲线。

**核心直觉**：幅值与相位合成一条轨迹，轨迹相对临界点的位置帮助判断闭环根数。

**关键公式**：
$$
L(j\omega)=\Re L(j\omega)+j\Im L(j\omega).
$$

**学习目标**：画出简单频率轨迹，并说明使用奈奎斯特判据时还需要哪些信息。

---

## 详情

### 完整解释

#### 图的两根轴是什么

横轴是环路频率响应的实部，纵轴是虚部；频率是沿曲线变化的参数，不是横坐标。点到原点的距离表示幅值，与正实轴的角度表示相位。因此伯德图与奈奎斯特图可以描述同一组频率响应数据。

实系数系统满足 $L(-j\omega)=\overline{L(j\omega)}$，正负频率部分关于实轴共轭对称。判稳需要完整围线及方向；只画正频率半条曲线，通常不足以直接数包围。

#### 一个可读的教学例子

取 $L(s)=2/(s+1)$：
$$
\Re L(j\omega)=\frac2{1+\omega^2},\qquad
\Im L(j\omega)=-\frac{2\omega}{1+\omega^2}.
$$
消去频率得 $(\Re L-1)^2+(\Im L)^2=1$。正频率轨迹从 $(2,0)$ 出发，经 $\omega=1$ 时的 $(1,-1)$，沿下半圆趋于原点。负频率给出上半圆。

该开环没有右半平面极点，完整轨迹不包围 $-1$；闭环 $2/(s+3)$ 也直接表明稳定。这里用闭环求根交叉检查，避免把画图误差当成结论。

#### 怎样把轨迹用于判稳

对标准负反馈特征式 $1+L(s)=0$，临界点为 $-1+j0$。设右半平面开环极点数为 $P$，完整奈奎斯特围线取包围右半平面的顺时针方向，并令映射曲线对 $-1$ 的顺时针净包围数为 $N$，则闭环右半平面根数满足 $Z=P+N$。若改用逆时针正号约定，公式符号也随之改变。

虚轴上有开环极点时要绕开奇点并计入对应映射；穿过临界点时属于边界情形。开环不稳定系统还必须知道 $P$，不能只凭某处相角裕度为正判断稳定。

#### 自检

1. 本例 $\omega=1$ 的幅值和相位是多少？
2. 图上某段靠近原点，是否意味着该段频率很低？

**核对要点**：幅值 $\sqrt2$、相位 $-45^\circ$；不一定，频率应由轨迹标签与方向确定。

### 关联节点

- **图谱关联**：时延效应、相位裕度、完整围线映射与频率轨迹。
- **学习延伸**：伯德图核对幅相读数，增益裕度和相角裕度描述相对稳定性。
