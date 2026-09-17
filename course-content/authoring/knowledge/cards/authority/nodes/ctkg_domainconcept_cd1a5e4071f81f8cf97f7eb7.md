---
node_id: ctkg_domainconcept_cd1a5e4071f81f8cf97f7eb7
authority_entity_id: "ctkg:domainconcept:cd1a5e4071f81f8cf97f7eb7"
name: "离散超前补偿"
name_en: "Discrete Lead Compensation"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-6d24ad3b8f0261bd796794ee8515eead4b824db5a40361d1de33feffc2fffff2.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-6d24ad3b8f0261bd796794ee8515eead4b824db5a40361d1de33feffc2fffff2.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/previous/ctkg_domainconcept_cd1a5e4071f81f8cf97f7eb7.md"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-professional-09a/supporting-source-inventory.json"
asset_refs: []
---

## 首页
# 离散超前补偿 | Discrete Lead Compensation

一句话定义：离散超前补偿通过数字极零点配置在一定频带提供正相位，同时改变幅频特性，需要结合对象核验闭环效果。

- 正相位不等于任意闭环都更稳定。
- 高频增益变化会影响噪声与控制使用量。
- 数字频率与物理频率通过采样周期联系。

---
## 详情
### 完整解释

考虑一阶形式 $C(z)=K(1-az^{-1})/(1-bz^{-1})$。对本卡采用的实数配置 $0<b<a<1$、K>0，零点比极点更靠近z=1，在0到π的数字频率区间内形成相位超前。增益K决定整体幅值尺度，不改变这个配置的相位符号。

相位超前常用于调整交越附近的动态，但补偿器同时改变增益，交越频率可能因此移动。是否增加完整闭环的相位裕量，应检查对象与补偿器乘积，而不能只看C本身有正相位就给出所有闭环性能结论。

### 教学计算/推理例

取直流归一化补偿器

$$
C(z)=\frac83\frac{1-0.7z^{-1}}{1-0.2z^{-1}}.
$$

零点为0.7、极点为0.2。直流增益为 $C(1)=(8/3)(0.3/0.8)=1$，数字Nyquist频率增益为 $C(-1)=(8/3)(1.7/1.2)=34/9$。因此它虽然保持直流增益为1，却显著提高了高频相对增益，不能只讨论相位而忽略幅值代价。

在单位圆 $z=e^{j\Omega}$ 上，有

$$
\operatorname{Im}C(e^{j\Omega})=
\frac{K(a-b)\sin\Omega}{|1-be^{-j\Omega}|^2}.
$$

对本例a-b为正，且 $0<\Omega<\pi$ 内正弦为正、分母为正，故虚部为正，得到正相位。Ω=π/3时相位约为32.11度。两端Ω=0和Ω=π的响应为正实数，相位回到零，不能把“超前”理解为所有频率都增加同一个固定角度。

### 差分实现与动态

将传递关系改写为

$$
u[k]=0.2u[k-1]+\frac83 e[k]-\frac{28}{15}e[k-1].
$$

从零历史开始，对单位阶跃误差，前两拍输出为8/3和4/3，随后趋近1。初始较大的响应与最终单位直流增益相容：瞬态与稳态由不同部分共同决定。这个例子只验证给定输入下的补偿器，不是完整闭环的超调测试。

将它与 $C_{\mathrm{lag}}(z)=(3/8)(1-0.2z^{-1})/(1-0.7z^{-1})$ 相乘，结果恒为1。互为倒数的结构便于核对相位符号和幅值关系，但不是要求工程中总把这两个环节同时串联；那样在理想代数模型下会相互抵消。

### 适用条件与边界

高频增益相对增大可能让测量噪声更明显地进入控制通道，具体影响取决于完整反馈结构和噪声注入位置。若执行器幅值或速率有限，需要核验瞬态输入是否可实现。不能仅凭单位直流增益就认定全过程输入与未补偿时相同。

本例极点0.2使补偿器本身稳定，但与对象互连后仍需重新计算闭环极点和裕量。采样周期改变时，相同数字频率Ω对应不同物理频率ω，固定系数未必仍覆盖原先希望调整的频带。

极零点位置和归一化方式有多种参数表达，应从所用C(z)直接核验。特别是将z与z的逆混写、交换a与b，会把超前变成滞后，不能只凭参数名称判断。

### 常见误区

1. 只看补偿器正相位就承诺所有闭环都稳定。
2. 忽略高频增益和初始控制输出的增加。
3. 把单位直流增益误作全部频率单位增益。

### 自检

1. 本例直流增益与数字Nyquist频率增益为何不同？
2. 交换极点和零点并重新归一化会得到哪类作用？

**核对要点**：极零点使增益随频率变化，分别为1和34/9；本例交换后得到对应的相位滞后作用。

### 关联节点

- **数字超前补偿**（无向，关系：相关）
