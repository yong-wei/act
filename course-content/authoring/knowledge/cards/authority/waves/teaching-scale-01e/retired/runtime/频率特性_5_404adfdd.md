---
node_id: 频率特性_5_404adfdd
name: 频率特性
name_en: Frequency Characteristic
lesson_units:
  - 2-3
  - 2-4
  - 3-7
category: 概念性
knowledge_type: X
chapter: 5
tags:
  - 层1精化
  - 频域分析
  - 2-3
card_version: 2
source_docs:
  - authoring/lessons/2-3/design/2-3-handout.md
  - authoring/lessons/2-4/design/2-4-handout.md
  - authoring/lessons/3-7/design/3-7-handout.md
asset_refs:
  - 2-3-info.png
  - 2-4-fd-08-bode-nyquist-consistency-panel.svg
---

## 首页

# 频率特性 | Frequency Characteristic

**一句话定义**：系统在不同正弦频率下的幅值比与相位差随频率变化的整体规律。

**核心直觉**：它像一张“按频率索引的规则表”，告诉你每个节奏会被怎样处理。

**关键公式**：
$$
G(j\omega)=A(\omega)e^{j\varphi(\omega)}
$$

**关联**：前置 → 正弦稳态响应、传递函数 · 后续 → 幅频特性、相频特性、伯德图、开环幅相特性曲线

---

## 详情

### 完整解释

如果把正弦稳态响应看成“系统对一个频率的回答”，那么频率特性就是把所有频率的回答排成一条曲线。它不再盯着某一时刻的输出，而是关心频率变化时，系统的放大能力和相位拖后怎样变化。

这也是 `G(s)` 过渡到 `G(j\omega)` 的真正意义。你不是换了一个新对象，而是把传递函数放到“纯振荡频率”这条观察线上来读。

到 `2-4`，这个对象还会继续推进一步：伯德图把它拆成幅值和相位两张图，开环幅相特性曲线则把它重新收束到复平面轨迹上。因此，`2-4` 不是另起炉灶，而是在继续把“频率特性”变成更完整的图形语言。

![同一频率特性在 Bode 与 Nyquist 上的两种表达](../../lessons/2-4/media/processed/2-4-fd-08-bode-nyquist-consistency-panel.svg)

### 常见误区

1. **误区**：频率特性只是一条图形结果。
   **纠正**：图是表现形式，核心是“系统逐频率处理输入”的规律。

2. **误区**：频率特性只关心幅值，不关心相位。
   **纠正**：幅值和相位缺一不可，少了相位就读不出真正的动态拖后。
