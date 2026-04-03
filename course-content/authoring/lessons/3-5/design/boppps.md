# 单元 3-5 BOPPPS 课案 | 零点引入与动态改善——为什么改变结构后，轨迹和响应会一起变

> **课时**：2 学时（90 分钟）
> **知识类型**：[X] + [C]
> **教学主线**：沿 `只调增益为什么不够 -> 零点怎样重排根轨迹 -> 结构实现如何比较 -> 非最小相边界` 这条链，把零点从概念讲成判断语言。

---

## B — Bridge-in 桥接引入（8 分钟）

### 回到地图（3 分钟）

**教师活动**：展示知识地图，高亮 `3-4 -> 3-5 -> 3-6` 路径，明确 `3-4` 负责“沿既有根轨迹判断”，`3-5` 负责“结构变化为何改写轨迹”。

**层次切换语**
> “上一课我们学会了沿着原来的轨迹做判断；今天要回答的是，当原轨迹本身已经不够理想时，怎样让它换一种走法。”

### 问题导入（5 分钟）

**教师活动**：展示封面图 [3-5-cover-comic.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-cover-comic.png)，提出三问：

- 只调增益为什么很快就会遇到边界？
- 零点为什么不是“更大增益”的别名？
- 为什么右半平面零点会把“零点改善动态”变成带条件的判断？

---

## O — Objective 学习目标（4 分钟）

本课结束后，学生应能够：

1. 用实例说明“纯增益调整”和“引入零点”在根轨迹骨架上的本质差异；
2. 通过二阶、三阶对象图像对比，判断左半平面零点怎样改写主导分支与终点分配；
3. 推导并使用 `PD` 与测速反馈的等效阻尼表达式，解释它们的共同点与不同点；
4. 先比较 `PD` 与超前装置的幅频/相频特性，再说明一个主打“抬交叉”、一个主打“补相角”；
5. 解释非最小相这一名称的来源，并用实例说明右半平面零点的逆响应与相位滞后边界。

---

## P1 — Pre-assessment 前测（6 分钟）

### 形式

- 平台 3 题即时前测 + 1 次举手判断

### 题目设计

1. 如果系统仍在稳定窗口内，是否就意味着继续增大增益一定值得？
2. `PD` 和测速反馈都能减小振荡，它们是否只是名字不同？
3. 一个零点让系统更快，是否就能推断“零点越靠右越好”？

### 调整策略

- 若多数学生把“稳定”直接等同于“更优”，则在 P2 第一段加重“根轨迹骨架 vs 参数点位”的区分；
- 若多数学生把 `PD` 与测速反馈混为一谈，则在 P2 第二段先做结构辨认，再讲公式。

---

## P2 — Participatory Learning 主体教学（64 分钟）

### 第一段：零点一旦出现，根轨迹骨架就变了（18 分钟）

**教师活动**

- 展示 [3-5-rl-01-low-order-zero-compare.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-rl-01-low-order-zero-compare.png) 与 [3-5-rl-02-high-order-zero-compare.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-rl-02-high-order-zero-compare.png)；
- 固定句式：先看开环极点、再看零点位置、再看哪条分支被拉走。

**学生活动**

- 口头判断“终点分配、实轴区段、主导分支”分别哪里发生了变化；
- 填写 `零点作用判断表` 前两列。

**关键提醒**

- 本段不接受“因为加了零点所以更快”的空泛回答，必须指出具体哪条分支被改写。

### 第二段：`PD` 与测速反馈（20 分钟）

**教师活动**

- 展示 [3-5-md-01-pd-rate-structure.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-md-01-pd-rate-structure.png)，辨认结构；
- 板书并推导：
  $$
  \zeta_{PD}=\zeta+\frac{1}{2}K_d\omega_n,\qquad
  \zeta_v=\zeta+\frac{1}{2}K_t\omega_n
  $$
- 再展示 [3-5-rl-03-pd-rate-compare.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-rl-03-pd-rate-compare.png)，比较根轨迹、阶跃和频率特性。

**学生活动**

- 根据目标阻尼 $\zeta^\star=0.5$ 反求 `K_d=K_t=0.3`；
- 填写 `结构对比解释` 中的“共同点/不同点”两栏。

**关键提醒**

- 必须让学生明确说出：测速反馈不增加前向零点。

### 第三段：`PD` 与超前（14 分钟）

**教师活动**

- 展示 [3-5-rl-04-pd-lead-compare.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-rl-04-pd-lead-compare.png)；
- 先板书并口头比较单独装置的幅频/相频特性：
  $$
  |G_{PD}(j\omega)|=\sqrt{1+(\omega T_d)^2},\qquad
  \phi_{PD}(\omega)=\arctan(\omega T_d)
  $$
  $$
  |G_{\text{lead}}(j\omega)|=\sqrt{\frac{1+(\omega T)^2}{1+(\alpha\omega T)^2}},\qquad
  \phi_{\text{lead}}(\omega)=\arctan(\omega T)-\arctan(\alpha\omega T)
  $$
- 先解释 `PD` 是通过持续抬升中高频幅值，把交叉频率往右推；再解释超前是通过在目标频带制造相位峰，把截止频率附近的相角裕度抬起来；
- 最后再读综合图，顺序固定为“右下开环幅频/相频 -> 上方根轨迹 -> 左下阶跃响应”。

**学生活动**

- 在 `频域对比卡` 上分别写出：
  `PD` 先抬什么、因此哪一个频域量会右移、主要代价是什么；
  超前先补什么、因此哪一个稳定性指标会改善、高频代价为什么更可控；
- 用一句完整话解释“为什么超前更像在关键频带补相角，而不是更强的 `PD`”。

**关键提醒**

- 本段不能把“零点位置相同”当作第一结论，第一结论必须是两种装置的幅相整形目标不同。

### 第四段：非最小相边界（12 分钟）

**教师活动**

- 展示 [3-5-rl-05-nmp-compare.png](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-5/media/processed/3-5-rl-05-nmp-compare.png)；
- 先讲名称来源，再讲逆响应和相位滞后。

**学生活动**

- 在 `风险边界卡` 上写出“最小相 / 非最小相”的一句区分；
- 说明为什么非最小相对象往往要先保守带宽。

---

## P3 — Post-assessment 后测（6 分钟）

### 题目

1. 为什么“零点引入”不是“继续增大增益”的另一种表达？
2. 为什么 `PD` 与测速反馈在阻尼结果上可能相似，但结构判断上不能看成同一个东西？
3. 为什么不能把超前校正说成“更强的 `PD`”？回答中必须同时出现“截止频率”或“相角裕度”中的至少一个词。
4. 为什么非最小相对象第一反应通常不是“继续把带宽往上推”？

### 反馈方式

- 平台即时显示正确率；
- 教师只对错误率最高的一题追问，要求学生回答中必须同时出现“轨迹/时域/频域”中的至少两个域。

---

## S — Summary 总结（2 分钟）

**核心要点**

- 纯增益调整只是在原轨迹上选点，零点引入会改写轨迹骨架；
- `PD` 的频域本质是抬升中高频幅值、推动截止频率右移；超前的频域本质是在目标频带补相角、提高相角裕度；
- 测速反馈和 `PD` 都能提高阻尼，但测速反馈不显式增加前向零点；
- 右半平面零点是非最小相边界，最典型的时域现象是逆响应，最直接的频域后果是额外相位滞后。

**铺垫语**
> “下一课 `3-6` 会把今天的结构比较放到统一对象实验里，让你真正看到三域联动是怎样同时变化的。”
