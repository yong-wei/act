---
node_id: ctc_modeling-239e401e0fcc8485f3a0533d
authority_entity_id: "ctc:modeling-239e401e0fcc8485f3a0533d"
name: "结构图等效化简法"
name_en: "Equivalent Block Diagram Simplification"
category: 程序性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-ab63cc37c61042e57a3639790d8b72b90eaa4e82b00d78956cf8fa7cb8c4eabf.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-ab63cc37c61042e57a3639790d8b72b90eaa4e82b00d78956cf8fa7cb8c4eabf.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-05a/previous/ctc_modeling-239e401e0fcc8485f3a0533d.md"
asset_refs: []
---

## 首页

# 结构图等效化简法 | Equivalent Block Diagram Simplification

**一句话定义**：结构图等效化简法用更简洁的拓扑表示同一组保留下来的变量关系。

**核心直觉**：等效的对象是端口之间的关系，不是图形外观；删去中间变量前，先确定哪些输入、输出和内部量仍需要回答。

**关键公式**：$\left(s^2+3s+4\right)Y=2R+2(s+1)D$。

**学习目标**：选择等效化简的边界，保持多输入关系，并判断外部传递函数相同是否足以支持当前分析任务。

---

## 详情

### 完整解释

“等效”必须先说明相对于哪些端口。若当前任务只关心一个输入 $R$ 和一个输出 $Y$，中间变量可以被消去，结构也可以变得很短；若任务同时关心扰动 $D$、内部测量或某个状态，等效边界就必须扩大。结构图等效化简的核心不是把所有线条都压成一个方框，而是在指定保留变量之后，维护它们之间的全部关系。

用带扰动的固定模型说明边界选择。信号关系为
$$
e=r-y,\qquad v=G_1e,\qquad w=v+d,\qquad y=G_2w,
$$
其中
$$
G_1=\frac{1}{s+1},\qquad G_2=\frac{2}{s+2}.
$$
在零初态下消去 $E$、$V$ 和 $W$，得到
$$
\left(s^2+3s+4\right)Y=2R+2(s+1)D.
$$
如果保留的端口是 $R$、$D$ 和 $Y$，这条式子就是一个足够的外部等效关系，也可写成叠加形式
$$
Y=\frac{2}{s^2+3s+4}R+\frac{2(s+1)}{s^2+3s+4}D.
$$
它明确保留了两个输入的位置差异。只取参考通道时令 $D=0$，得到 $Y/R=2/(s^2+3s+4)$；只取扰动通道时令 $R=0$，得到 $Y/D=2(s+1)/(s^2+3s+4)$。两个分子不同，说明同一输出边界受不同输入路径影响。

如果还需要解释内部动态，就不能把 $v$ 与 $w$ 当成无关细节。取 $v$、$y$ 为状态，模型满足
$$
\dot v=r-y-v,\qquad \dot y=2(v+d)-2y.
$$
外部等效关系保留了输入到输出的行为，但没有自动保留每个内部变量的物理含义、初值约束或测量位置。删去中间变量之后，仍应能回答任务要求的问题；若回答不了，就说明等效边界选得过窄，而不是说明原图“还不够简洁”。

等效化简还要求明确“保持不变”的关系。若比较的是单位阶跃下的最终输出，参考输入和扰动输入在本例中都趋向 $0.5$；若比较起步方式，参考通道的初始输出斜率为 $0$，扰动通道为 $2$。因此只保留一个直流数字，会把两条不同动态路径误合并。把等效化简看成端口关系的保持，就能自然地决定应保留哪些通道。

### 教学计算/推理例

分别列出两个候选等效模型的保留端口。候选模型甲只保留 $R\to Y$，它可以正确回答参考输入通道的问题；候选模型乙保留 $R,D\to Y$，它还能回答扰动通道的问题。对单位阶跃输入，两个通道的最终输出都为 $0.5$，但初始斜率不同，所以甲不能冒充乙。若题目再询问 $v$ 或 $w$，乙也仍需补回相应内部关系。

### 适用条件与边界

本例在零初态、线性定常和给定输入位置下讨论代数等效。等效关系只对声明的端口和变量成立；外部传递函数相同，不保证内部状态、约束、饱和位置、故障可诊断性或实现方式相同。若要研究这些内部性质，应保留相应变量和方程，不能把“输入输出等效”扩大解释为“系统内部完全相同”。

### 常见误区

1. **误区**：化简后只剩一个 $Y/R$，所以它就是原系统的完整等效模型。**纠正**：$Y/R$ 只回答 $D=0$ 的参考通道；有扰动或内部测量时必须保留相应关系。
2. **误区**：只要两个模型的稳态输出相同，就可以认为它们等效。**纠正**：等效要保持指定端口关系和动态行为，直流终值不能代替分子、瞬态和内部约束的检查。

### 自检

1. 选择 $R,D,Y$ 为保留端口时，为什么不能只写 $Y/R$？
2. 如果任务需要内部状态 $v$，等效化简后至少还应保留什么信息？

**核对要点**：保留两个输入时要同时给出 $R$、$D$ 到 $Y$ 的关系；需要内部状态时，必须保留状态定义及其方程或等价的内部约束。

### 关联节点

- **结构图化简法则**（无向，关系：相关）
- **框图化简**（无向，关系：相关）
- **系统结构图**（无向，关系：相关）
