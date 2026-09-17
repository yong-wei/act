---
node_id: ctkg_m1s-object-5f9ee607698d576a63deb905
authority_entity_id: "ctkg:m1s-object-5f9ee607698d576a63deb905"
name: "逆系统"
name_en: "Inverse System"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consixt_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b08a7e27c52ed993fe8ac3f3fcfedb2a4aeca7600f15326390c28e48be69af94.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b08a7e27c52ed993fe8ac3f3fcfedb2a4aeca7600f15326390c28e48be69af94.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-13a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 逆系统 | Inverse System

一句话定义：逆系统根据期望的输出过程构造所需输入，在满足可逆性、初态与实现条件时，使其与原系统串联产生指定输出。

- 逆关系必须说明允许的输出函数和初态。
- 非线性逆不总是唯一、全局或可因果实现。
- 逆前馈本身不等于完整的鲁棒跟踪控制。

---
## 详情
### 完整解释

若原系统把输入u映射为输出y，逆系统希望从给定的期望输出求出能够产生它的输入。这个关系不仅涉及代数函数，也可能涉及输出的导数、积分和初始状态。所要求的输出必须属于原系统能够实现的轨迹集合，而不是任意指定的信号。

对动态系统，匹配初态很重要。即使输入表达式正确，也不能使连续状态在初始时刻无条件跳到另一个指定值。设计时应明确逆是用于已知参考的前馈、动态补偿，还是与反馈共同使用。

### 教学计算/推理例

取 $\dot x=-x^3+u$、y=x，模型精确且没有输入幅值限制。希望输出为可微函数yd(t)，由原方程可以反求

$$
u_d(t)=\dot y_d(t)+y_d(t)^3.
$$

选择yd=sin(t)，则所需输入为 $u_d=\cos t+\sin^3t$。如果初态x(0)=yd(0)=0，把x=sin(t)和该输入代回原方程，右侧为 $-\sin^3t+\cos t+\sin^3t=\cos t$，与期望输出导数一致。

局部解唯一性使这个满足初值和原方程的轨迹成为系统响应。因此在声明的条件下，原系统与逆输入组合确实产生sin(t)，而不是仅在几个时刻碰巧匹配。

如果初态改为x(0)=1，期望仍从sin(0)=0开始，就不能沿用“从初始时刻精确等于参考”的结论。相同前馈输入不会使状态瞬时跳变；需要另行处理初始误差及其动态。

### 导数、因果性与噪声

逆公式需要参考的导数。本例参考是已知解析函数，导数可以直接计算；这与对含噪实时测量进行理想微分不是同一实现条件。对于一般输入，精确微分可能放大噪声或不满足实际带宽要求。

高相对阶对象的逆可能需要更多导数，线性对象的代数逆也可能是不适当有理或非因果的。应明确如何生成所需参考信息，不能只写出逆算式就认定数字或物理装置能够原样实现。

### 可逆性与内部动态

非线性输出映射可能限制允许的输出。例如y=x²不能产生负输出，而且同一个正输出可以对应正、负两个状态分支，必须结合初态和工作区域判断。需要除以某个状态相关系数的逆公式，还应检查该系数是否为零。

对于多状态系统，输入输出逆可能只规定可见输出，而留下内部状态。若这些内部动态不稳定，即使输出匹配，也不代表整个系统安全或稳定。逆系统设计应结合内部状态条件，而不能只验证一条输出曲线。

### 适用条件与边界

本例逆输入属于基于精确模型的前馈，没有显式利用状态误差修正。模型失配、扰动或输入饱和会改变实际响应，若需要误差收敛或鲁棒保证，应构造相应反馈并重新分析。

逆系统的作用是提供一种输入构造关系，不等于“任何参考都能实现”或“逆总能稳定原对象”。参考光滑性、初态、可逆区域、内部动态和输入能力必须共同核验。

### 常见误区

1. 忽略初态不匹配，却声称从一开始精确跟踪。
2. 反求出含导数的输入就默认可以无噪声实现。
3. 输出匹配就省略内部状态与扰动检查。

### 自检

1. 本例sin(t)参考所需的逆输入是什么？
2. x(0)=1时为何不能立即得到y(0)=0？

**核对要点**：cos(t)+sin³(t)；连续状态初值已固定，有限输入不能让它在初始时刻无条件跳变。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
