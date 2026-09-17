---
node_id: ctc_modeling-7aef273143199795496abedb
authority_entity_id: "ctc:modeling-7aef273143199795496abedb"
name: "结构图等效代数运算"
name_en: "Equivalent Block Diagram Algebra"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5ede491b85551e7dbf25e8e571918de9aa28c14285474b607388e81efad31331.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5ede491b85551e7dbf25e8e571918de9aa28c14285474b607388e81efad31331.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-05a/previous/ctc_modeling-7aef273143199795496abedb.md"
asset_refs: []
---

## 首页

# 结构图等效代数运算 | Equivalent Block Diagram Algebra

**一句话定义**：移动求和点或引出点、交换比较点并合并方框时，必须用补偿增益保持变量关系不变。

**核心直觉**：移动的是结构位置，保持的是每条旁路的数值关系；符号挪动后，旁路信号也要跟着变换。

**关键公式**：$2(a+b)=2a+2b=8$，而 $2a+b=2(a+b/2)=5$。

**学习目标**：检查求和点和引出点移动前后的信号值，识别必须补加的增益以及动态逆环节的实现边界。

---

## 详情

### 完整解释

结构图的代数运算可以改变方框、求和点和引出点的相对位置，但等效的判据始终是：对同一组输入，保留下来的输出和旁路变量关系必须相同。移动一个符号后，不能只看主通道是否“看起来连上了”，还要检查所有绕过方框的支路。最稳妥的做法是先给每个节点命名，再在移动前后分别写出该节点的表达式。

固定 $G=2$、$a=1$、$b=3$ 做三个检查。若求和点位于方框前，原关系是
$$
y=2(a+b)=2(1+3)=8.
$$
把求和点移到方框后，两个输入都必须经过同一个增益，关系变为
$$
y=2a+2b=2\cdot1+2\cdot3=8.
$$
结果相同，是因为两条支路都保留了方框的作用。

反过来，若求和点原来位于方框后，关系是
$$
y=2a+b=2\cdot1+3=5.
$$
移到方框前时，$b$ 这条支路若仍直接相加就会被额外乘以 $2$，所以必须补上相应比例，写成
$$
y=2\left(a+\frac{b}{2}\right)=2\left(1+\frac{3}{2}\right)=5.
$$
这里的 $b/2$ 不是新的物理信号，而是为了抵消方框对该支路产生的放大。

引出点移动遵循同一原则。原来在方框前引出 $a$，旁路需要保持 $a$；若先经过方框得到 $z=2a$，再从输出端引出，旁路就必须经过 $1/2$，因为
$$
\frac{z}{2}=\frac{2a}{2}=a.
$$
若把方框换成动态传递函数 $G(s)$，形式上的补偿可能写成 $1/G(s)$，但这只说明代数关系。若逆环节不是有理可实现形式或本身不稳定，图上的等效变换并不等于可以制造一个这样的补偿器。先完成关系核对，再单独检查实现性。

### 教学计算/推理例

把“移动前”和“移动后”各写一遍，而不是凭箭头位置判断。求和点在方框前时，输出由整体放大后的 $(a+b)$ 给出；移到后面后，每条支路都要带上增益。求和点在方框后时，未经过方框的 $b$ 支路必须在移动前先除以该方框增益。引出点同理：输出端的分支要先除以方框增益，才能还原输入端原来的旁路值。

### 适用条件与边界

本例的数值只用于检验静态代数关系。对动态方框，移动规则还受初态、非真有理逆、逆环节稳定性、饱和和噪声影响；形式上相等的连接不必然是可实现的工程结构。若图中还有其他输入或内部测量，必须逐条检查它们是否仍得到原来的表达式。

### 常见误区

1. **误区**：移动求和点或引出点只需改变图形位置，旁路信号可以原样接回。**纠正**：移动后要给旁路补上或去掉相应增益，使每个节点的表达式保持不变。
2. **误区**：代数上出现 $1/G(s)$，就说明补偿器一定能在系统中实现。**纠正**：动态逆可能非真有理或不稳定，代数等效与物理可实现性是两个判断。

### 自检

1. 为什么把“方框前求和”移到“方框后”时，$a$ 和 $b$ 两条支路都要乘以 $2$？
2. 把引出点从 $G=2$ 的输入移到输出后，旁路应取 $z$ 的什么比例？

**核对要点**：移动后每条支路仍需产生原方框作用，所以得到 $2a+2b$；若 $z=2a$，旁路必须取 $z/2$，才能保持原来的 $a$。

### 关联节点

- **结构图绘制规范步骤**（无向，关系：相关）
