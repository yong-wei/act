---
node_id: ctkg_domainconcept_1126ce54b22f0fafb3f6e916
authority_entity_id: "ctkg:domainconcept:1126ce54b22f0fafb3f6e916"
name: "无纹波最小拍系统设计方法"
name_en: "Ripple-Free Deadbeat Design Method"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-3bde33176dc7d8575877f265e665f4bff01b70d29f9b8fdf920225ba57efb377.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-3bde33176dc7d8575877f265e665f4bff01b70d29f9b8fdf920225ba57efb377.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-10a/previous/ctkg_domainconcept_1126ce54b22f0fafb3f6e916.md"
asset_refs: []
---

## 首页
# 无纹波最小拍系统设计方法 | Ripple-Free Deadbeat Design Method

一句话定义：无纹波最小拍设计同时约束输出与控制序列，并回到连续对象检查有限拍后是否真正保持稳态。

- 输出有限拍整定与控制输入整定需要共同核验。
- 对象零点及实现约束影响目标闭环选择。
- 传递函数的形式条件仍需连续状态证明。

---
## 详情
### 完整解释

单位负反馈中，输出与控制对参考的传递关系分别为 $Y/R=\Phi$ 和 $U/R=\Phi/G$。只让Phi产生有限拍样值响应，可能仍让输入在后续不断调整内部状态，留下采样间纹波。因此设计无纹波方案时，应同时研究Phi/G的时间响应及最终保持输入。

这些代数关系建立在零初态及明确参考通道上。对于具体连续对象，还需核对有限拍后的状态是否与最终输入组成平衡。不能只在一个分式中补上因子，就把所有对象的无纹波性当作已经证明。

### 教学计算/推理例

连续对象为 $\dot x_1=-x_1+x_2$、$\dot x_2=-x_2+u$，输出x1，零初态、T=1零阶保持、单位阶跃参考，输入无幅值约束。令 $a=e^{-1}$、$b=1-2a$、$d=(1-a)^2=b+a^2$，精确离散对象为 $G(z)=(bz+a^2)/(z-a)^2$。

选择保留对象零点的目标

$$
\Phi(z)=\frac{bz+a^2}{dz^2}.
$$

此时 $U/R=(z-a)^2/(dz^2)$ 是有限延迟多项式。由 $C=\Phi/[G(1-\Phi)]$ 反求得

$$
C(z)=\frac{(z-a)^2}{dz^2-bz-a^2}.
$$

两边同除z²即可写成因果差分关系。其分母常数项d不为零，当前输出可由当前误差、历史误差和历史控制计算。对象本身严格因果，不引入当前输出与输入之间的代数循环。

### 控制序列与平衡检查

记q为z的逆，则 $U/R=(1-2aq+a^2q^2)/d$。乘上单位阶跃的 $R=1/(1-q)$，可直接读出u[0]=1/d、u[1]=(1-2a)/d，后续u[k]=(1-2a+a²)/d=1。控制输入经过两拍后保持所需稳态值。

这还只是序列检查。把前两次输入施加给精确状态模型，可以得到x[2]=[1,1]。从这一时刻起u=1，使连续方程两项导数同时为零，因此y(t)=1对所有t至少为2成立。状态检查把“输入已固定”与“输出无纹波”连接起来，避免漏掉仍可能存在的内部运动。

### 误差序列与稳定性

令α=b/d、β=a²/d，则Phi=αq+βq²，且α+β=1。单位阶跃误差为e[0]=1、e[1]=β、e[k]=0（k至少为2）。相比只追求一拍样值的方案，这里允许多一个误差样值，以换取第二拍后的连续平衡。

原互连在未约消前的特征多项式为 $d z^2(z-a)^2$，所以内部特征根为0、0、a、a，全部稳定。这个检查防止只见简化Phi的两个零极点，就忽略约消部分。稳定约消仍不代表任意初态或模型失配都具有相同有限拍响应。

### 适用条件与边界

本例对象零点在单位圆内，保持输入可自由取所需数值，并且平衡状态可在两拍到达。非最小相位零点、更多延迟、输入上限或不同参考类别会改变设计条件，不能直接套用相同Phi。无纹波最少拍数应结合可达性论证；本例一拍不能同时使两状态为1，两拍构造才达到要求。

若实际系数有量化或模型误差，理想的精确有限拍整定可能变为近似整定，应报告真实残差和采样间偏差。算法名称不能代替对实际实现的核验。

### 常见误区

1. 只设计Phi，不检查Phi/G及保持输入。
2. 输入不再变化就直接认定内部状态已经平衡。
3. 使用约消后的低阶式省略内部稳定检查。

### 自检

1. 本例为什么把对象的零点保留在Phi中？
2. 哪一步证明第二拍后连续输出确实不变？

**核对要点**：使Phi/G成为可实现的有限延迟多项式并获得有限拍控制整定；精确递推到x=[1,1]后，代入u=1的连续平衡方程。

### 关联节点

- **纹波**（无向，关系：相关）
- **无纹波最小拍系统**（无向，关系：相关）
- **最小拍系统设计方法**（无向，关系：相关）
