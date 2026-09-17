---
node_id: ctkg_m1s-object-83dd51199b51fd3fb2ccfdeb
authority_entity_id: "ctkg:m1s-object-83dd51199b51fd3fb2ccfdeb"
name: "卡尔曼-雅库波维奇-波波夫引理"
name_en: "Kalman-Yakubovich-Popov Lemma"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-c5723850b05e053d19a6c9957a5ed0bf1b5df766e3143a56454dacd40814008f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-c5723850b05e053d19a6c9957a5ed0bf1b5df766e3143a56454dacd40814008f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-13a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 卡尔曼-雅库波维奇-波波夫引理 | Kalman-Yakubovich-Popov Lemma

一句话定义：KYP引理把适用条件下的频率域性质与状态空间矩阵证书联系起来，本卡介绍严格正实判定的经典版本。

- 必须声明所用版本及最小实现条件。
- 正定矩阵证书需要回代全部等式。
- 频率正实与耗散不等式通过储能函数连接。

---
## 详情
### 完整解释

在本文采用的版本中，实有理方阵传递函数 $G(s)=C(sI-A)^{-1}B+D$ 具有可控且可观测的实现。它严格正实，当且仅当存在 $P=P^T>0$、相容维数的L、W及正常数ε，使

$$
PA+A^TP=-L^TL-\varepsilon P,\qquad
PB=C^T-L^TW,\qquad W^TW=D+D^T.
$$

这给出一种不用在有限频率网格上猜测全部频率性质的代数证据。矩阵P正定和三条等式必须同时成立；只求一个李雅普诺夫方程，却不检查输入输出耦合条件，并不是这个引理的完整应用。

### 教学计算/推理例

取标量最小实现 $\dot x=-x+u$、y=x，即A=-1、B=C=1、D=0，传递函数为G=1/(s+1)。选择P=1、L=1、W=0、ε=1，则

$$
PA+A^TP=-2=-1-1,
\qquad PB=1=C^T-L^TW,
\qquad W^TW=0=D+D^T.
$$

P严格为正，三条等式都满足，因此这个实现符合所选严格正实版本的条件。这里没有把矩阵求解器返回成功当作证明，而是逐条回代了证书。

也可从频率定义交叉核对：$\operatorname{Re}G(j\omega)=1/(1+\omega^2)>0$。更完整地，取移位δ=1/2，则G(s-δ)=1/(s+1/2)正实，符合严格正实的移位定义。这个δ是定义中的移位量，不要不加说明地与矩阵证书里的ε混为同一个参数。

### 与储能和无源性的联系

取储能函数V=x²/2，沿原状态方程有 $\dot V=-x^2+ux=uy-x^2$。输入输出供能uy减去储能变化率，等于非负耗散x²；非零状态产生严格的状态耗散。

这一计算说明频率性质并非孤立标签，它通过同一个状态实现与储能不等式相连。对一般矩阵证书，使用 $V=x^TPx/2$ 可以得到相应的耗散关系，但仍需保持输入输出符号和所用无源性定义一致。

### 严格性的含义

本例虽然严格正实，实部在高频仍趋于零，因此不存在对所有频率都成立的统一正常数下界。若另一种阻抗定义要求 $\operatorname{Re}G(j\omega)>\delta>0$，不能仅凭这里的严格正实结论就认为本例也满足那个更强要求。

普通正实引理与本文严格版本也不同。例如G=1/s可以是正实，但它在原点有极点，不能通过任意正的左移参数满足这里的严格正实定义。应先辨认目标性质，再使用对应版本，不能把半定与严格条件随意替换。

### 适用条件与边界

最小实现条件避免仅从可见传递函数推断隐藏状态。若实现含未被输入输出观察到的不稳定模态，传递函数本身的性质不能直接说明整个非最小状态模型内部稳定。应用前应核验可控性与可观测性，或使用适合当前实现的相应版本。

KYP还有其他频率约束和广义形式。本卡没有把所列三条等式宣称为所有版本的统一公式，也没有据此替代任意非线性系统的完整稳定性分析。

### 常见误区

1. 只检查A的稳定性而不检查P、B、C、D的耦合等式。
2. 有限频率样本实部为正就声称完成全频率证明。
3. 把不同无源或严格正实定义中的严格性混用。

### 自检

1. 本例P=L=1、W=0、ε=1需要核验哪几类条件？
2. 为何本例没有统一的正实部下界，却仍可以严格正实？

**核对要点**：P正定及全部三条矩阵等式；严格正实采用相应移位定义，与全频率统一正常数下界不是同一个要求。

### 关联节点

- **卢里叶问题**（无向，关系：相关）
