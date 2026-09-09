---
node_id: ctkg_v3e-canonical-299c52f97e423f68b4ac6093
authority_entity_id: "ctkg:v3e-canonical-299c52f97e423f68b4ac6093"
name: "稳态性能"
name_en: "Steady-state Performance"
category: 概念性
knowledge_type: C
bloom_level: 理解
lesson_units:
  - "3-7"
card_version: 2
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.37
status: ready
source_docs:
  - course-content/authoring/lessons/3-7/design/3-7-handout.md
  - course-content/authoring/lessons/2-2/design/2-2-handout.md
asset_refs: []
---

## 首页

# 稳态性能 | Steady-state Performance

**一句话定义**：稳态性能描述过渡过程结束后，系统跟踪给定和抵抗扰动的精度。

**核心直觉**：输入形式与作用通道共同决定稳态误差。

---

## 详情

### 完整解释

稳定系统的过渡分量衰减后，输出与目标之间仍可能存在偏差。对理想测量反馈，误差信号为 $e(t)=r(t)-y(t)$；终值存在时，稳态误差为

$$
e_{ss}=\lim_{t\to\infty}e(t).
$$

评价稳态性能需要说明输入是阶跃、斜坡还是其他形式，以及扰动从哪里进入。系统型别、低频增益和扰动通道共同影响误差。某一阶跃跟踪误差为零，不代表对斜坡或不同位置的扰动也能保持零误差。

### 阶跃跟踪示例

设稳定闭环系统 $\Phi(s)=4/(s+5)$，参考输入为单位阶跃，测量理想。输出终值为 $\Phi(0)=0.8$，因此 $e_{ss}=0.2$。响应可以平稳收敛，同时保留固定的跟踪偏差。

### 动态与稳态的配合

增大低频增益或增加积分环节可改变稳态误差，但也会改变动态响应和稳定裕度。评价设计时，稳态误差应与超调、调节时间及控制量一起检查。

### 关联节点

稳态误差 · 终值定理 · 系统型别 · 低频增益
