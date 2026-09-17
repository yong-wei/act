---
node_id: ctkg_v3e-object-a5bc9701adc27b91f6da074b
authority_entity_id: "ctkg:v3e-object-a5bc9701adc27b91f6da074b"
name: "劳斯阵列第一列"
name_en: "First Column of the Routh Array"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9bd36350a8a2429e7cd82baee0f89d2accead06b0108e40c43912349e5ceb531.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9bd36350a8a2429e7cd82baee0f89d2accead06b0108e40c43912349e5ceb531.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-16a/previous/ctkg_v3e-object-a5bc9701adc27b91f6da074b.md"
asset_refs: []
---

## 首页

# 劳斯阵列第一列 | First Column of the Routh Array

**一句话定义**：在正确处理特殊行后，劳斯阵列第一列的符号变化次数给出特征多项式右半平面根数。

不要把首列单零、全零行和已经找到虚轴根当成同一种情况。

---

## 详情

### 完整解释

劳斯阵列把实系数多项式的根位置问题转化为系数递推问题。第一列承载了符号计数信息：按规定处理零元素等特殊情形后，相邻非零符号的变化次数对应右半平面根数，按重数计。它不是直接列出所有根，也不直接给出振荡频率或衰减速度。

若最高次项系数取正，严格稳定的常见情形要求第一列全部为正，并确认没有遗留虚轴或原点根。单纯看到“没有符号变化”仍要检查是否曾出现全零行及其辅助多项式，不能忽略这些步骤带来的边界信息。

计算中可将某行除以正数以简化系数，但不能随意翻转符号后还按原方法计数。每一步的分母、符号及是否为零都应保留。对于含参数的阵列，还需要区分参数使某项恰好为零的边界，而不是一律把它当普通非零数处理。

### 教学计算/推理例

取实多项式

$$p(s)=s^4+2s^3+3s^2+6s+5.$$

前两行系数为 $(1,3,5)$ 与 $(2,6,0)$。下一行得到 $(0,5,0)$：首列元素为零，但整行并非全零，因此不能套用全零行的辅助多项式法。

用正无穷小 $\varepsilon$暂代这个首列零，后续第一列为

$$1,\quad2,\quad\varepsilon,\quad6-\frac{10}{\varepsilon},\quad5.$$

当 $\varepsilon\to0^+$时，符号依次为正、正、正、负、正，共有两次符号变化，因此有两个右半平面根。对原多项式直接求根也得到相同数目；不能把替代后的多项式当成原对象的真实参数修改。

本例原系数全部为正，首列却揭示不稳定根。首列零也没有自动证明存在虚轴根：它首先是阵列递推的一种特殊情形，必须按极限继续分析。把零直接略去、把整行改成上一行导数或随便取一个不够小的常数，都可能破坏正确判断。

### 适用条件与边界

正无穷小是极限记号，数值验证只能选择足够小的正值并确认符号规律。在本例中，只要 $0<\varepsilon<5/3$，第四个元素就是负数，因此符号结论可以直接由不等式核实，不必依赖某一次浮点计算。

若出现的是全零行，则需要构造辅助多项式并保留其根的信息，流程不同。若常数项为零，还应识别原点根。最终报告应同时说明右半平面根数和边界根情况，尤其在把“无右半平面根”进一步解释为稳定时不能省略后者。

本法针对连续时间实系数特征多项式。它回答根在哪个半平面，不说明输入输出通道是否最小，也不直接给出真实设备的稳定裕度。控制模型的建立、反馈符号和被忽略动态仍需要另外核对。

### 常见误区

1. 误区：首列出现零就表示系统临界稳定。纠正：要先区分零的形式并继续判别，本例实际存在两个右半平面根。
2. 误区：可以把含零行删掉后继续数符号。纠正：删行会丢失递推信息，应采用相应的极限或辅助多项式处理。

### 自检

1. 为什么本例不使用辅助多项式的导数来替换行？
2. 第一列从正变负再变正说明多少个右半平面根？

**核对要点**：该行其余元素为5，属于首列单零而非全零行。两次符号变化对应两个右半平面根，结论可由原多项式求根核对。

### 关联节点

- **劳斯表**（出边，关系：组成部分属于）
