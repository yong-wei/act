---
node_id: 静态速度误差系数_3_ba8e28bb
name: 静态速度误差系数
name_en: Velocity Error Constant
lesson_units:
  - 3-7
category: 概念性
knowledge_type: C
chapter: 3
tags:
  - 3-7
  - Kv
  - 斜坡误差
card_version: 1
source_docs:
  - authoring/lessons/3-7/design/handout.md
asset_refs: []
---

## 首页

# 静态速度误差系数 | Velocity Error Constant

**一句话定义**：衡量系统对斜坡输入跟踪能力的低频指标，直接对应斜坡稳态误差大小。

**核心直觉**：`K_v` 越大，斜坡跟踪越准；但“无穷大”通常意味着型别已经变了。

**关键公式**：
$$
K_v=\lim_{s\to0}sG(s)H(s)
$$

**关联**：前置 → 系统型别、静态误差系数 · 后续 → 低频补偿稳态改善路径

## 详情

### 完整解释

`3-7` 用 `K_v` 把两类低频补偿路径拉到同一张表上比较：

- `PI`：通过提高型别，让斜坡误差从有限值变成 0；
- 滞后：型别一般不变，但可把 `K_v` 从较小数值抬到目标值。

因此，`K_v` 是连接“型别是否变化”和“低频精度是否真的提升”的中间量。

### 常见误区

1. **误区**：`K_v` 只和增益大小有关。
   **纠正**：它既受增益影响，也受原点积分个数影响。

2. **误区**：`K_v` 足够大就等于一定改型别。
   **纠正**：滞后就能在型别不变时显著提高 `K_v`。
