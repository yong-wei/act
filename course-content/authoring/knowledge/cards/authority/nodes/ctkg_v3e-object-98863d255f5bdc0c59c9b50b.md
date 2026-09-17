---
node_id: ctkg_v3e-object-98863d255f5bdc0c59c9b50b
authority_entity_id: "ctkg:v3e-object-98863d255f5bdc0c59c9b50b"
name: "PBH秩检验法（可观测性）"
name_en: "PBH Observability Test"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-32df4f69d9a607947e8033b384e847ff74b45e1c9d4b14ad293dfb4f8ad459fa.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-32df4f69d9a607947e8033b384e847ff74b45e1c9d4b14ad293dfb4f8ad459fa.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-03a/previous/ctkg_v3e-object-98863d255f5bdc0c59c9b50b.md"
asset_refs: []
---

## 首页
# PBH秩检验法（可观测性） | PBH Observability Test

一句话定义：PBH可观测性判据要求对A的每个特征值检验 $[C;\lambda I-A]$ 是否满列秩，从而排除输出不可见的模态。

- 可观测性检查采用竖直堆叠。
- 不可见模态对应被C消去的右特征向量。
- 需检查全部特征值，不能只看稳定或实数模态。

---
## 详情
### 完整解释

对n维线性定常状态模型，若对A的所有特征值都有 $\operatorname{rank}[C;\lambda I-A]=n$，则系统完全可观测。等价地，不存在非零右特征向量 $v$ 满足 $Av=\lambda v$ 且 $Cv=0$。

模态 $v e^{\lambda t}$ 若被C完全消去，便不能从输出看出其初始幅值。此处使用右特征向量，与可控性PBH的左特征向量条件相对应。矩阵拼接方向和向量方向都不能混用。

### 教学计算/推理例

取 $A=[[-3,-2],[1,0]]$、$C=[1,3]$，特征值为 $-1,-2$。对应堆叠矩阵分别为 $[[1,3],[2,2],[-1,-1]]$ 与 $[[1,3],[1,2],[-1,-2]]$，两者秩均为2，系统可观测。

在 $\lambda=-1$ 处可取右特征向量 $v=[-1,1]^T$，有 $Cv=2\ne0$；在 $\lambda=-2$ 处可取 $v=[-2,1]^T$，有 $Cv=1\ne0$。两种模态都能影响输出，与秩结果一致。

反例取 $A_h=\operatorname{diag}(-1,2)$、$C_h=[1,0]$。对 $\lambda=2$，堆叠矩阵为 $[[1,0],[3,0],[0,0]]$，秩为1。右特征向量 $[0,1]^T$ 被C消去，第二状态的增长不会出现在输出中。

### 适用条件与边界

不可观测模态可以稳定，也可以不稳定。若只要求构造渐近收敛的状态估计，涉及可检测性等更弱条件；本卡判断的是完全可观测性，不能把这两个标准混称。发现一个不可见稳定模态仍意味着不满足全可观测。

PBH要求在复数域检查所有特征值；重复特征值的模态结构由秩条件覆盖。数值上近重根或尺度差异可能影响秩容差，应将计算输出与模型结构交叉核验，不应只因一个软件返回满秩就忽略明显的弱观测问题。

该判据属于线性定常有限维模型。未知输入、非线性测量或时变状态矩阵下的观测问题需要对应定义与方法。理论模态可见也不等于实际噪声下估计精度良好。

### 常见误区

1. 将C横向拼在可控性矩阵后面，维度与语义都不匹配。
2. 把右特征向量条件写成可控性的左向量条件。
3. 只检验一个模态可见，就宣称系统全部可观测。

### 自检

1. 反例中 $Cv=0$ 对 $v=[0,1]^T$ 表示什么？
2. 不可观测模态若稳定，系统是否因此变成完全可观测？

**核对要点**：该模态初始幅值无法由输出区分；稳定不改变可见性，仍不满足全可观测标准。

### 关联节点

本卡的结论可由上述定义与计算例独立复核。
