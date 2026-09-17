---
node_id: ctkg_domainconcept_28bfca2df331c329cea26464
authority_entity_id: "ctkg:domainconcept:28bfca2df331c329cea26464"
name: "朱利稳定判据"
name_en: "Jury Stability Criterion"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7f315649c9753d68d38dc53f8bc41116476a1f213d3803e8e7ed9a3ed1e5e429.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7f315649c9753d68d38dc53f8bc41116476a1f213d3803e8e7ed9a3ed1e5e429.json
  - course-content/authoring/knowledge/cards/nodes/朱利判据_7_bfd80014.md
asset_refs: []
---

## 首页

# 朱利稳定判据 | Jury Stability Criterion

**一句话定义**：利用实系数离散特征多项式的系数，判断全部根是否严格位于单位圆内的方法。

**核心直觉**：连续判稳看左半平面，离散判稳看单位圆，不能直接共用根的位置标准。

**关键公式**：
$$
p(z)=z^2+a_1z+a_0:\quad |a_0|<1,\quad1+a_1+a_0>0,\quad1-a_1+a_0>0.
$$

**学习目标**：应用二阶实首一多项式的完整条件，解释等号与高阶情形的边界。

---

## 详情

### 完整解释

#### 本卡先处理二阶情况

首页的三个严格不等式，对实系数首一二阶多项式是根全部位于开单位圆内的充要条件。若最高次系数不为 $1$，应先除以该非零系数得到首一形式。高阶系统需要完整朱利阵列或等价 Schur 判别步骤，不能只检查这三个二阶条件。

前两处代入还可理解为检查 $p(1)$ 和 $p(-1)$。若相应项变为零，说明可能在 $z=1$ 或 $z=-1$ 出现单位圆边界根；严格稳定不能包含等号。

#### 稳定与不稳定的对照

教学例 $p_1(z)=z^2-0.7z+0.1$ 满足：$|0.1|<1$，$1-0.7+0.1=0.4>0$，$1+0.7+0.1=1.8>0$。直接分解为 $(z-0.5)(z-0.2)$，两根均在单位圆内。

对 $p_2(z)=z^2-1.3z+0.24$，虽然 $|0.24|<1$，但 $p_2(1)=-0.06<0$，因此不稳定。直接求根约为 $1.0772$ 与 $0.2228$，其中一根越过单位圆。

若 $p_3(z)=z^2-1.2z+0.2=(z-1)(z-0.2)$，$p_3(1)=0$，属于边界而非严格稳定。

#### 与其他判据的关系

劳斯表直接用于连续系统的左半平面根。通过适当双线性变量变换，可以把单位圆问题转化为半平面问题后再判别，但必须实际完成变换。图谱中朱利、劳斯、单位圆和阵列之间的关系是方法联系，不能据此省略两种稳定区域的区别。

系统是否内部稳定还取决于完整状态或未消去特征方程；不要只靠约分后隐藏了模态的输入输出式作保证。

#### 自检

1. $z^2+0.2z+0.5$ 是否满足二阶条件？
2. 三阶多项式可否只检验 $|a_0|<1$ 和 $p(\pm1)$？

**核对要点**：满足，三项分别为 $0.5<1$、$1.7>0$、$1.3>0$；高阶不能省略完整条件。

### 关联节点

- **图谱关联**：朱利阵列、朱利稳定条件、z 平面单位圆及劳斯方法。
- **学习延伸**：脉冲传递函数给出模型，零阶保持与采样周期影响模型参数。
