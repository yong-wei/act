---
node_id: ctkg_v3e-object-69aaaef625010f7755f253e8
authority_entity_id: "ctkg:v3e-object-69aaaef625010f7755f253e8"
name: "死区"
name_en: "Dead zone"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "5-1"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/knowledge/cards/nodes/死区特性_8_9ed850fc.md
  - course-content/authoring/lessons/5-1/design/5-1-handout.md
asset_refs: []
---

## 首页

# 死区 | Dead zone

**一句话定义**：输入在某一阈值范围内变化时，输出保持为零或不发生有效变化的非线性现象。

**核心直觉**：控制器发出的小修正可能没有传递到执行机构。

---

## 详情

### 对称死区模型

设死区半宽为 $d>0$，阈值外斜率为 $k>0$，常用模型为

$$
y=
\begin{cases}
k(u-d),&u>d,\\
0,&|u|\le d,\\
k(u+d),&u<-d.
\end{cases}
$$

这里整个死区的宽度为 $2d$。在阈值附近，单一线性增益不能描述输入输出关系，因此叠加原理通常失效。

### 小指令示例

取 $d=0.2$、$k=1$。输入 $u=0.1$ 时输出为零；输入 $u=0.5$ 时输出为 $0.3$；输入 $u=-0.5$ 时输出为 $-0.3$。

执行机构的起动摩擦、阀门的不灵敏区等都可能表现为小指令不起作用。闭环系统可能因此出现小误差难以消除、间歇修正或低幅振荡，具体行为还取决于控制器与对象动态。

### 使用条件

建模时应说明阈值、正负方向是否对称，以及阈值外的斜率。利用实验输入跨越阈值，可以区分正常的小增益响应与真正的无响应区。
