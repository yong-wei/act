---
node_id: ctkg_v3e-object-23665070dce851fbb0ebda8b
authority_entity_id: "ctkg:v3e-object-23665070dce851fbb0ebda8b"
name: "辅助多项式"
name_en: "Auxiliary Polynomial in the Routh Array"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-fe038ae28f9bb67bc9631fa164571fbe264bc8a175e2601fc06276cdb327a00c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-fe038ae28f9bb67bc9631fa164571fbe264bc8a175e2601fc06276cdb327a00c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-16a/previous/ctkg_v3e-object-23665070dce851fbb0ebda8b.md"
asset_refs: []
---

## 首页

# 辅助多项式 | Auxiliary Polynomial in the Routh Array

**一句话定义**：劳斯阵列出现全零行时，由其上一行系数构造辅助多项式，用于识别对称根结构并继续判别。

全零行与首列单个元素为零不同，不能使用同一种处理替代。

---

## 详情

### 完整解释

构造劳斯阵列时，某一整行全部为零，说明多项式中存在使常规递推中断的对称根结构。处理方法是从上一行系数及对应幂次写出辅助多项式，再用它的导数系数替换全零行，继续构造阵列。与此同时，应单独分析辅助多项式的根，不能只看补算后的第一列就遗漏边界模态。

上一行的幂次必须保留。例如该行对应 $s^2$，两项系数应组合成二次项与常数项；不能把它们顺次写成二次项和一次项。辅助多项式反映的对称结构可能包括虚轴根，也可能包括左右成对的实根或其他对称根，因此不能一见全零行就宣布系统恰好稳定。

若只是首列某个元素为零、该行其余元素并非全零，则不是本卡的全零行情形。常见处理是使用正的无穷小替代并考察极限，不能直接从上一行导数重写整行。辨清触发条件，是避免误数右半平面根的关键。

### 教学计算/推理例

取

$$p(s)=s^4+2s^3+2s^2+2s+1=(s^2+1)(s+1)^2.$$

劳斯阵列前两行分别为 $(1,2,1)$ 与 $(2,2,0)$，递推得到 $s^2$行的系数 $(1,1,0)$，随后 $s^1$行全为零。于是辅助多项式为

$$A(s)=s^2+1,\qquad A'(s)=2s.$$

用导数系数 $(2,0,0)$ 替换全零行后继续计算。同时由 $A(s)$可知存在根 $\pm j$，其余根是重复的-1。虽然没有右半平面根，简单虚轴模态仍使系统不满足严格渐近稳定；不能把“右半平面根数为零”自动写成“全部根严格在左半平面”。

再看含原点根的例子 $q(s)=s^4+s^3+s^2+s=s(s+1)(s^2+1)$。这里首次全零行上方对应的辅助多项式为 $s^3+s$，是奇数次并含原点根。这说明“辅助多项式总是偶数次”不能在没有附加条件时使用；应按实际上一行的幂次构造，而不是强行补成偶数次。

### 适用条件与边界

本例的因子分解为劳斯处理提供了独立核对。实际参数多项式也应把辅助多项式根和其余部分共同分析，明确是否有右半平面、虚轴或原点根及其重数。涉及重边界根时，还不能忽略相应运动的有界性条件。

阵列行可以按正数缩放而不改变第一列符号计数；辅助多项式也可整体乘非零常数而保持根不变，但解释系数时要保持一致。若处理过程中随意改变行的符号，却继续按原符号数根，可能得到错误结论。本卡的数值例保留了简单的原始系数，便于逐行复算。

### 常见误区

1. 误区：首列出现零就必须构造辅助多项式。纠正：本法对应全零行，首列单零属于不同特殊情况。
2. 误区：全零行只代表虚轴根，系统因此稳定。纠正：要解辅助多项式并检查其余根，边界也不等于严格渐近稳定。

### 自检

1. 为什么本例从 $(1,1,0)$构造的是 $s^2+1$，而不是 $s^2+s$？
2. 含原点根的第二例为何不能强行使用偶数次辅助多项式？

**核对要点**：劳斯行的幂次隔一项排列，必须保留行标记。第二例上一行对应奇次幂，实际多项式为 $s^3+s$，它同时体现原点根与对称根对。

### 关联节点

- **劳斯表**（出边，关系：组成部分属于）
- **对称根对**（出边，关系：包含组件）
- **对称根对**（无向，关系：相关）
