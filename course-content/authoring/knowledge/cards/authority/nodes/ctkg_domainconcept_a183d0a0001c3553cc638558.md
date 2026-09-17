---
node_id: ctkg_domainconcept_a183d0a0001c3553cc638558
authority_entity_id: "ctkg:domainconcept:a183d0a0001c3553cc638558"
name: "离散模型"
name_en: "Discrete-Time Model"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
consevent_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-e7d42c770968459176476d0bebd595367030885ac0aad9cef6e60a43061e4c28.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-e7d42c770968459176476d0bebd595367030885ac0aad9cef6e60a43061e4c28.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/previous/ctkg_domainconcept_a183d0a0001c3553cc638558.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-08a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 离散模型 | Discrete-Time Model

一句话定义：离散模型用递推关系描述相邻离散时刻的状态变化，并通过输出方程给出可观测量。

- 步索引k与物理时间需要通过采样周期联系。
- 初态响应不能由零状态传递函数代替。
- 离散模型的精确性取决于建模与保持假设。

---
## 详情
### 完整解释

离散状态模型常写为 $x[k+1]=Ax[k]+Bu[k]$、$y[k]=Cx[k]+Du[k]$。前式说明如何从当前状态和输入得到下一状态，后式说明当前输出与状态、输入的关系。矩阵、采样周期、变量单位、输入施加时序及初态都属于完整模型，不能只给一个递推系数就认为物理过程已经唯一确定。

离散模型可以来自连续对象的采样等效，也可以直接描述按步变化的过程。两者的时间含义和近似条件应明确。来自连续系统时，还要说明采样间输入如何保持；“离散”本身既不意味着精确，也不意味着必然只是粗略近似。

### 教学计算/推理例

取标量模型

$$
x[k+1]=0.8x[k]+0.2u[k],\qquad y[k]=x[k].
$$

先令初态x[0]=1、全部输入为零，递推得到x[1]=0.8、x[2]=0.64、x[3]=0.512，一般项为 $x[k]=0.8^k$。这条响应完全来自初态，与零输入不矛盾；它说明状态储存的历史也能产生后续输出。

若改成初态零、输入从k=0起恒为1，则x[1]=0.2、x[2]=0.36、x[3]=0.488，一般项为 $x[k]=1-0.8^k$。相同动态系数在不同初态和输入下产生不同响应，计算时必须同时保留二者。

对单边z变换，递推方程给出 $zX(z)-zx[0]=0.8X(z)+0.2U(z)$，因此

$$
X(z)=\frac{0.2}{z-0.8}U(z)+\frac{z}{z-0.8}x[0].
$$

只有初态为零时，才能把输入输出传递函数写为 $G(z)=0.2/(z-0.8)$ 并用它独自计算总响应。第二项记录初态影响，不能因为输入为零就把总输出也设为零。

### 采样周期与时序

如果模型对应采样周期T，k步之后的物理时间为kT。每步乘0.8的衰减，在T=0.1和T=1的两个模型中对应不同的实际时间尺度。未给T时，可以讨论序列怎样按步演化，却不能直接报告以秒为单位的调节时间。

这个模型没有直接传递项，u[k]影响x[k+1]，而当前输出y[k]由x[k]决定。若实现中先把状态更新再把结果标记为y[k]，就会错移一个采样周期。索引只是符号，但不一致的索引会改变反馈时序与数据解释。

### 适用条件与边界

系数0.8、0.2可以由某种采样对象得到，也可以作为直接给定的离散模型。仅凭这两个数不能反推出唯一连续对象及采样方式。若关心采样间行为，还需要连续模型或明确的重建假设，不能随意用直线连接样值作为真实动态证明。

模型的参数误差、饱和、噪声和延迟是否可忽略，取决于目标任务。线性递推适用时可用叠加与矩阵方法分析；引入非线性限幅后，则不能继续把所有行为都归结为同一个线性传递函数。

### 常见误区

1. 输入为零就认为有初态的系统输出也必为零。
2. 用零状态传递函数省略初始条件项。
3. 未给采样周期却把步数直接当作秒数。

### 自检

1. 初态1、零输入时第三步状态是多少？
2. 当前模型中u[k]首先影响哪个状态样值？

**核对要点**：x[3]=0.512；首先影响x[k+1]，当前输出y[k]仍由当前状态给出。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
