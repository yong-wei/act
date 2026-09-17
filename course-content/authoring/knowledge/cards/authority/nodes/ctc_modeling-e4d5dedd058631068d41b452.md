---
node_id: ctc_modeling-e4d5dedd058631068d41b452
authority_entity_id: "ctc:modeling-e4d5dedd058631068d41b452"
name: "机理建模与分析流程"
name_en: "Mechanistic Modeling and Analysis Workflow"
category: 程序性
knowledge_type: X
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-682d472fc0962fb72fa91151ce22b7ce69282423d1a52f1471eb997aa5f6f7ae.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-682d472fc0962fb72fa91151ce22b7ce69282423d1a52f1471eb997aa5f6f7ae.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-01a/previous/ctc_modeling-e4d5dedd058631068d41b452.md"
asset_refs: []
---

## 首页

# 机理建模与分析流程 | Mechanistic Modeling and Analysis Workflow

**一句话定义**：从物理定律写出动态方程，再由输入输出关系得到传递函数并分析系统性质。

**核心直觉**：先保留物理平衡，再把参数压缩成时间尺度和增益；传递函数是分析入口，不是物理建模的起点。

**关键公式**：
$$
J\dot r+D r=M_\delta\delta\ \Longrightarrow\ T\dot r+r=K\delta.
$$

**学习目标**：能从转动平衡式得到 $T$、$K$，写出角速度和航向两种传递函数并检查极点与积分器。

---

## 详情

### 完整解释

机理建模与分析把“对象为什么这样运动”连接到“模型会怎样响应”。第一步根据物理定律写时间域平衡式。对固定工作点附近的转动对象，取转动惯性、线性阻尼和舵力矩，符号方程为
$$
J\dot r+D r=M_\delta\delta,
$$
其中 $r$ 是角速度，$\delta$ 是舵角，$J$ 是转动惯性，$D$ 是线性阻尼，$M_\delta$ 是舵角到力矩的系数。这里先保留符号，不捏造具体实船参数。

第二步明确输入和输出，再用 $D$ 除以方程，得到
$$
T\dot r+r=K\delta,\qquad T=\frac{J}{D},\qquad K=\frac{M_\delta}{D}.
$$
固定教学模型取 $T=5\ \mathrm{s}$、$K=0.2\ \mathrm{s^{-1}}$，于是
$$
5\dot r+r=0.2\delta.
$$
第三步在零初始角速度下取拉氏变换，得到舵角到角速度的传递函数
$$
\frac{R(s)}{\Delta(s)}=\frac{K}{Ts+1}=\frac{0.2}{5s+1}.
$$
其速率极点为 $s=-1/T=-0.2\ \mathrm{s^{-1}}$，表示角速度的自然衰减时间尺度。若输出改为航向 $\psi$，还要使用 $\dot\psi=r$，因此
$$
\frac{\Psi(s)}{\Delta(s)}=\frac{0.2}{s(5s+1)}.
$$
额外的 $1/s$ 不是参数变化，而是输出从角速度换成角度时引入的积分关系。

第四步才进入响应分析，例如对十度阶跃舵、零初态，角速度稳态为 $K\delta=2$ 度/秒，5 秒时为 $1.26424$ 度/秒。若把同一传递函数错误地当作航向传递函数，就会漏掉积分器并误判长期行为。完整流程要求每次改变输出、工作点或假设都重新检查方程、单位和极点。

### 教学计算/推理例

从符号式开始而不是从现成传函开始：
$$
J\dot r+D r=M_\delta\delta.
$$
除以 $D$ 后，$T=J/D=5\ \mathrm{s}$、$K=M_\delta/D=0.2\ \mathrm{s^{-1}}$，得到 $5\dot r+r=0.2\delta$。零初态下角速度传函为 $0.2/(5s+1)$，极点为 $-0.2\ \mathrm{s^{-1}}$；把输出改为航向后，传函变为 $0.2/[s(5s+1)]$。这三步分别对应物理定律、参数化简和输出定义。

### 适用条件与边界

本流程的数值参数是固定教学设定；$J$、$D$、$M_\delta$ 的实际值需要由具体对象、工作点和实验或识别数据确定。传递函数推导假设零初态，非零初态的自由响应需另行加入。线性阻尼、固定航速和小扰动超出适用范围时，应重新建立模型。恒定舵角下角速度可以趋于常数，但航向传函含积分器，不能据此声称航向收敛。

### 常见误区

1. **误区**：看到传递函数就不必再说明物理方程和输出定义。**纠正**：传递函数依赖输入、输出、初态和物理假设；换输出可能增加积分器。
2. **误区**：$T=5$ 秒、$K=0.2\ \mathrm{s^{-1}}$ 是任意实船的惯性和舵效。**纠正**：它们是本例的固定教学参数，不能替代具体对象的参数识别。

### 自检

1. 为什么从角速度输出改为航向输出后，传递函数会多出 $1/s$？
2. 由 $T=J/D$ 和 $K=M_\delta/D$ 得到 $5$ 秒和 $0.2\ \mathrm{s^{-1}}$ 时，速率极点是多少？

**核对要点**：$\dot\psi=r$ 的积分关系在零初态拉氏域中对应除以 $s$；速率极点为 $-1/T=-0.2\ \mathrm{s^{-1}}$。$J$、$D$、$M_\delta$ 的具体实物值不能从本例反推。

### 关联节点

- **动态系统建模规范步骤**（无向，关系：相关）
