---
node_id: 非线性微分方程的线性化_2_caa86ba6
name: 非线性微分方程的线性化
name_en: Linearization of Nonlinear Differential Equations
lesson_units:
  - 5-2
category: 程序性
knowledge_type: X
chapter: 5
tags:
  - 5-2
  - 局部线性化
card_version: 1
source_docs:
  - course-content/authoring/lessons/5-2/design/5-2-handout.md
asset_refs: []
---

## 首页

# 非线性微分方程的线性化

核心定义：在平衡点附近用泰勒展开的一阶项近似非线性方程。

关键公式：

$$
y=f(x_0)+f'(x_0)(x-x_0)
$$

关联节点：局部线性化工作点、非线性边界工具选择

---

## 详情页

线性化把非线性问题临时放回线性主干。它适合解释工作点附近的小扰动，不适合直接解释全局轨迹、饱和、死区和切换边界。

动态系统中，线性化对应雅可比矩阵。矩阵特征值能判断平衡点附近的局部稳定性，但不能保证远处轨迹也按同样方式运动。
