---
node_id: ctkg_v3e-object-bd932075b5f988acebafc1b5
authority_entity_id: "ctkg:v3e-object-bd932075b5f988acebafc1b5"
name: "塔斯廷法（双线性近似）"
name_en: "Tustin Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-eee03e83a79d86c2e48635dd4458c13202fb0cafa08846bb86ccbbb23a843980.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-eee03e83a79d86c2e48635dd4458c13202fb0cafa08846bb86ccbbb23a843980.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-02a/previous/ctkg_v3e-object-bd932075b5f988acebafc1b5.md"
asset_refs: []
---

## 首页
# 塔斯廷法（双线性近似） | Tustin Method

一句话定义：塔斯廷法以梯形积分为基础，用双线性代换构造连续模型的离散近似，并具有非线性的频率映射。

- 常用代换为 $s=(2/T)(z-1)/(z+1)$。
- 它与精确零阶保持等效不同。
- 频率扭曲和端点映射应明确说明。

---
## 详情
### 完整解释

对积分器，梯形规则写为 $y[k]-y[k-1]=T(u[k]+u[k-1])/2$。在零初态z域中，相当于用 $T(1+z^{-1})/[2(1-z^{-1})]$ 近似连续积分 $1/s$，由此得到

$$
s\approx\frac2T\frac{1-z^{-1}}{1+z^{-1}}=\frac2T\frac{z-1}{z+1}.
$$

把它代入适当连续传递函数可得到离散近似。该过程的数学来源是数值积分规则，不是对任意保持输入都逐采样时刻精确匹配的声明。

### 教学计算/推理例

对 $G_c(s)=1/(s+1)$，代换后

$$
G_T(z)=\frac{z+1}{(2/T+1)z+(1-2/T)}.
$$

取 $T=0.2$ s，得到 $G_T=(z+1)/(11z-9)$，极点为 $9/11\approx0.818182$。对应精确ZOH模型的极点为 $e^{-0.2}\approx0.818731$，两者接近但不相等，且Tustin模型具有零点 $z=-1$，输入输出时序和结构也不同。

在单位圆 $z=e^{j\Omega}$ 上，代换给出 $\omega=(2/T)\tan(\Omega/2)$，即 $\Omega=2\arctan(\omega T/2)$。低频时近似 $\Omega\approx\omega T$，但接近离散奈奎斯特频率时偏差明显。不能把所有连续频率都按同一个常数比例搬到离散轴。

### 适用条件与边界

双线性映射把连续左半平面映到单位圆内，对合适有理模型可保留相应极点稳定区域。它仍不保证任意性能指标完全一致，也不能替代对延迟、采样保持、有限字长和实际实现的检查。

若希望某一关键频率准确对齐，可采用预畸变等设计，但应明确修改的尺度和目标频率，不能声称同时精确匹配整个频段。本卡使用普通 $2/T$ 代换，没有额外预畸变。

有直接通道的离散形式可能在当前时刻使用当前输入，实现反馈时要核验计算顺序和代数关系。非零初态也不能仅由传递函数代换完整确定，状态初始化需与具体实现相匹配。纯延迟通常需要单独处理，不能任意用同一有限有理式精确表示。

### 常见误区

1. 将Tustin近似说成精确ZOH离散等效。
2. 忽略频率扭曲，在高频仍假定 $\Omega=\omega T$。
3. 只因极点仍稳定就断言全部时域性能保持不变。

### 自检

1. 本例周期0.2 s时，Tustin与ZOH极点各约多少？
2. 普通Tustin是否对所有频率保持线性频率比例？

**核对要点**：约0.818182与0.818731；不保持，实际关系包含正切或反正切，需要按目标频段核验。

### 关联节点

- **连续校正离散化方法**（无向，关系：相关）
