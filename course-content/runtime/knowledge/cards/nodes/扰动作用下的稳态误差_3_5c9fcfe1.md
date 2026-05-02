---
node_id: 扰动作用下的稳态误差_3_5c9fcfe1
name: 扰动作用下的稳态误差
name_en: Steady-State Error under Disturbance
lesson_units:
  - 3-7
category: 概念性
knowledge_type: X
chapter: 3
tags:
  - 3-7
  - 扰动
  - 抗干扰
card_version: 1
source_docs:
  - authoring/lessons/3-7/design/3-7-handout.md
asset_refs:
  - 3-7-example2-structure.png
---

## 首页

# 扰动作用下的稳态误差 | Steady-State Error under Disturbance

**一句话定义**：系统在外加扰动作用下留在比较点或输出端的最终残余偏差。

**核心直觉**：扰动问题先问“从哪里进来”，再问“最后留下多少”。

**关键公式**：
$$
\frac{E_d(s)}{D(s)}=-\frac{G_p(s)H(s)}{1+G_c(s)G_p(s)H(s)}
$$

**关联**：前置 → 误差传递函数 · 后续 → 给定-扰动双通道误差分析

## 详情

### 完整解释

`3-7` 把扰动稳态误差从旧教材里的“附加情况”升级成主线对象。原因很简单：只要题目显式给出扰动通道，它就不能再被压扁成“给定输入的另一种波形”。

![3-7 例题 2 双输入结构](../../lessons/3-7/media/processed/3-7-example2-structure.png)

这也是为什么本课要特别强调“输出通道”和“误差通道”都要写出来。抗扰问题真正看的不是跟踪误差表，而是扰动项怎样穿过闭环并留在误差上。

### 常见误区

1. **误区**：扰动也是输入，所以直接套输入型别表。
   **纠正**：扰动的关键是进入位置，不是信号外形。

2. **误区**：抗扰问题只看输出，不用看误差。
   **纠正**：稳态误差问题必须回到误差对象本身。
