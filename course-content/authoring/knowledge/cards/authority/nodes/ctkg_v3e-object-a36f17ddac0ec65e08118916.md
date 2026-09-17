---
node_id: ctkg_v3e-object-a36f17ddac0ec65e08118916
authority_entity_id: "ctkg:v3e-object-a36f17ddac0ec65e08118916"
name: "离散信号"
name_en: "Discrete-Time Signal"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fa079047e348c560e0dbe3defa956b3d2bc137e5a358c77fc179b6dcb13603c7.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fa079047e348c560e0dbe3defa956b3d2bc137e5a358c77fc179b6dcb13603c7.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-01a/previous/ctkg_v3e-object-a36f17ddac0ec65e08118916.md"
asset_refs: []
---

## 首页
# 离散信号 | Discrete-Time Signal

一句话定义：离散时间信号是按整数索引或离散时刻定义的一列数值，其幅值可以连续取值，也可以经过量化。

- 索引 $k$ 与实际时间需通过采样时序联系。
- 序列不等于唯一的连续波形。
- 时间离散与幅度离散应分别说明。

---
## 详情
### 完整解释

一个序列可记为 $x[k]$。如果由周期采样产生，则 $x[k]=x_c(kT_s)$；如果原本来自按步更新的算法，则需另外给出每一步对应的时间含义。仅列出序号0、1、2，并不能判断间隔是秒、毫秒还是没有指定物理单位。

理想离散时间信号的每个值可为任意实数。数字存储通常还限制幅值表示精度，但量化是额外操作。冲激列是在连续时间中承载样值的数学表示，零阶保持则把样值扩展到一段时间，二者都不应与数值序列直接混同。

### 教学计算/推理例

序列 $x[k]=\cos(0.4\pi k)$ 的前几个值约为1、0.30902、$-0.80902$、$-0.80902$、0.30902、1，具有5个索引间隔的周期。若 $T_s=0.1$ s，它可来自2 Hz余弦，也可来自8 Hz余弦等混叠信号；若 $T_s=0.05$ s，同一序列可对应4 Hz基带余弦。

因此“离散频率 $0.4\pi$”并不单独给出连续频率，必须知道采样周期并限定频率范围。即使知道周期，也还需要带限等先验排除混叠。

再把每个样值以步长0.25量化，0.30902可舍入为0.25，$-0.80902$可舍入为 $-0.75$。改变的是幅值表示，索引时刻没有变化。反过来，如果保留高精度幅值却降低采样率，仍可能引入频率混叠。这两个操作造成的误差来源不同。

### 适用条件与边界

不是每个离散正弦都具有有限整数周期。序列 $\cos(\Omega k)$ 的周期性要求存在正整数 $N$ 使 $\Omega N$ 为 $2\pi$ 的整数倍，因此与 $\Omega/(2\pi)$ 是否有理有关。不能从本例5拍周期推广到全部离散频率。

重建连续波形需要指定插值或保持规则及先验。折线连接、零阶保持与理想带限插值会得到不同的区间内曲线；它们都经过同一样点也不意味着彼此等价。绘制样值时可用离散标记，若连接线仅为视觉辅助，应避免把它误当成实际连续响应。

信号可在全部整数或仅非负整数上定义，变换和初态分析应遵循相应约定。若涉及截取的数据段，还需区分有限记录与原始无限序列，不要把观察窗造成的频谱变化全部归因于系统本身。

### 常见误区

1. 将离散时间信号定义成幅值必为整数或有限等级。
2. 由同一序列直接断定唯一连续频率。
3. 任意连接样点后就宣称恢复了真实采样间波形。

### 自检

1. 同一 $\cos(0.4\pi k)$ 在10 Hz与20 Hz采样率下，对应基带频率分别是多少？
2. 对样值量化后，采样时刻是否自动改变？

**核对要点**：分别为2 Hz与4 Hz；不会，量化改变幅值表示，时间索引仍按原时序。

### 关联节点

- **采样率**（无向，关系：相关）
- **采样率**（出边，关系：推导自）
- **采样数据**（出边，关系：属于）
