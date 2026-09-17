---
node_id: ctkg_v3e-object-0e5df270abeaa062e3a81d33
authority_entity_id: "ctkg:v3e-object-0e5df270abeaa062e3a81d33"
name: "采样过程"
name_en: "Sampling Process"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f6f5bae7446bd4bf1d6911d3b1b4144cefe964d3c48d3a0b83695b5c724c3a45.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f6f5bae7446bd4bf1d6911d3b1b4144cefe964d3c48d3a0b83695b5c724c3a45.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-01a/previous/ctkg_v3e-object-0e5df270abeaa062e3a81d33.md"
asset_refs: []
---

## 首页
# 采样过程 | Sampling Process

一句话定义：采样过程在指定时刻取得连续信号的值，形成离散时间序列；理想分析中也可用带样值权重的冲激列表示。

- 序列、冲激列和保持后的连续信号不是同一对象。
- 时间离散不自动意味着幅值量化。
- 采样周期决定取值时刻，原对象可在其间继续演化。

---
## 详情
### 完整解释

均匀采样的基本关系为 $x[k]=x(kT_s)$。整数 $k$ 标记样值序号，$T_s$ 是时间间隔。这个序列只记录指定时刻的数值，不直接告诉我们两次采样之间发生了什么。

在连续时间数学表达中，理想采样可写为 $x_s(t)=\sum_kx(kT_s)\delta(t-kT_s)$。冲激的权重等于样值，不能把冲激画成普通有限高度、有限宽度脉冲后仍声称完全相同。若再使用零阶保持器，输出在两个更新时刻之间保持某个值，得到阶梯状连续时间信号，这是后续保持操作。

### 教学计算/推理例

考虑连续对象 $\dot x=-x+u$，初态0，输入恒为1，解为 $x(t)=1-e^{-t}$。以 $T_s=0.2$ s采样，得到 $x[0]=0$、$x[1]\approx0.18127$、$x[2]\approx0.32968$。

在两个采样时刻之间，例如 $t=0.1$ s，对象实际状态为 $1-e^{-0.1}\approx0.09516$。这个状态确实存在，只是没有被该采样序列直接记录。不能把未记录理解为物理系统在间隔中没有状态。

若输入在每个区间保持为 $u[k]$，对象在采样时刻满足精确递推

$$
x[k+1]=e^{-T_s}x[k]+(1-e^{-T_s})u[k].
$$

这里的精确性依赖给定连续方程和分段常值输入。它不同于简单欧拉近似，也不说明任意采样间隔内变化的输入都能用同一系数乘一个样值精确代替。

### 适用条件与边界

实际采样设备具有采样保持、有限孔径、时钟误差和幅度转换等环节。理想点采样只描述其中的取值步骤。若采样不等间隔，应记录实际时刻 $t_k$，不能继续无条件使用固定 $T_s$ 的递推或频谱公式。

量化可写成 $Q(x[k])$，是样值取得后的幅度等级映射。即使样值保留无限精度，时间采样仍可能产生混叠；即使采样率很高，有限量化步长仍会造成幅值误差。两类问题应分别验证。

采样前的模拟滤波可限制带外成分，采样后的数字处理则只能使用已经获得的信息。若不同连续信号形成完全相同的样值序列，没有附加先验就不能从数字处理结果唯一恢复原始差异。

### 常见误区

1. 将序列 $x[k]$、冲激列和零阶保持波形混为一谈。
2. 认为采样间隔内连续对象没有状态或不会变化。
3. 把固定周期精确保持等效推广到任意输入波形。

### 自检

1. 本例 $t=0.1$ s不是采样时刻，状态是否仍然存在？
2. 将 $x[k]$ 变成有限二进制等级属于取样时刻变化还是幅度量化？

**核对要点**：存在，约0.09516；属于幅度量化，采样和量化需分开描述。

### 关联节点

- **保持器**（无向，关系：相关）
- **采样器**（无向，关系：相关）
- **模拟信号**（无向，关系：相关）
