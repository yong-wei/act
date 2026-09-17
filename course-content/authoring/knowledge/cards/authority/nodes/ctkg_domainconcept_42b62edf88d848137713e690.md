---
node_id: ctkg_domainconcept_42b62edf88d848137713e690
authority_entity_id: "ctkg:domainconcept:42b62edf88d848137713e690"
name: "数字滞后补偿"
name_en: "Digital Lag Compensation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-f5b31bb83acb422fe666c7d4c760d5afeeaa95a4fec78b1e23d0a9af884a091f.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-f5b31bb83acb422fe666c7d4c760d5afeeaa95a4fec78b1e23d0a9af884a091f.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/previous/ctkg_domainconcept_42b62edf88d848137713e690.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 数字滞后补偿 | Digital Lag Compensation

一句话定义：数字滞后补偿用离散极零点配置形成相位滞后及相对较强的低频作用，具体闭环收益取决于对象和完整设计。

- 补偿器稳定不等于闭环稳定。
- 低频相对增强与绝对直流增益应区分。
- 极零点、归一化增益和采样周期需要一起说明。

---
## 详情
### 完整解释

一阶数字补偿器可以写为 $C(z)=K(1-az^{-1})/(1-bz^{-1})$，其中a为零点、b为极点。对本卡研究的实数配置 $0<a<b<1$、K>0，在正频率区间内产生相位滞后。极点更靠近z=1，使相对于高频的低频作用较强，但绝对直流增益仍由K决定。

数字频率响应在单位圆上计算，令 $z=e^{j\Omega}$，Ω的单位是弧度每采样点，范围通常取0到π。若需要换成物理角频率，应使用Ω=ωT。不能直接把连续s平面的极零点位置和频率数值搬到z平面而省略这种区别。

### 教学计算/推理例

选择

$$
C(z)=\frac38\frac{1-0.2z^{-1}}{1-0.7z^{-1}}.
$$

零点为0.2、极点为0.7，均在单位圆内。直流取z=1，得到 $C(1)=(3/8)(0.8/0.3)=1$；数字Nyquist频率取z=-1，得到 $C(-1)=(3/8)(1.2/1.7)=9/34$。所以低频相对于最高数字频率的增益更强，但本例并没有把直流增益提高到大于1。

对一般上述形式，复数运算给出

$$
\operatorname{Im}C(e^{j\Omega})=
\frac{K(a-b)\sin\Omega}{|1-be^{-j\Omega}|^2}.
$$

在 $0<\Omega<\pi$ 内，分母严格为正、正弦为正，a-b为负，因此虚部为负，形成相位滞后。Ω=π/3时本例相位约为-32.11度。这个符号结论来自代数式，不是只抽查几个频率点后作出的全区间判断。

### 差分实现核对

从传递关系可得 $u[k]=0.7u[k-1]+0.375e[k]-0.075e[k-1]$。若历史误差e[-1]=0、输出u[-1]=0，误差从k=0起恒为1，则前两拍输出为0.375和0.5625，随后逐步接近1，与直流增益一致。

递推中上一拍输出反映补偿器的内部记忆。若实现时遗漏历史误差项或将其符号写反，就不再是同一个极零点配置。采样周期改变时，还需重新检查这些固定系数对应的物理频带是否仍满足设计目的。

### 适用条件与边界

滞后补偿常用于调整低频与交越附近的增益关系，但新增相位滞后也可能降低某些频率处的稳定余量。是否改善稳态精度，需要看补偿器的绝对增益、对象、反馈结构及闭环稳定条件，不能仅凭“滞后”这个名称承诺误差一定减小。

本例只分析了补偿器本身，没有指定被控对象或完整闭环。极点0.7证明这个一阶补偿器的内部零输入响应会衰减，却不能替代闭环极点分析。与对象互连后还需检查闭环稳定、控制幅值、噪声影响及采样间行为。

### 常见误区

1. 看到滞后结构就认为其绝对直流增益必然大于1。
2. 补偿器极点在单位圆内就认定完整闭环稳定。
3. 用数字频率Ω直接代替以弧度每秒计的物理频率。

### 自检

1. 本例直流和数字Nyquist频率增益各是多少？
2. 相位为负的全区间论证来自什么？

**核对要点**：分别为1和9/34；虚部表达式中的a-b为负，且在0到π之间正弦为正、分母为正。

### 关联节点

- **滞后补偿**（无向，关系：相关）
- **相位滞后补偿器**（无向，关系：相关）
