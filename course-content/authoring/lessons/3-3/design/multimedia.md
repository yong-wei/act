# 多模态资源设计 | 单元 3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移

本单元的图像资源围绕同一条判断链展开：参数变化如何变成闭环极点迁移，轨迹骨架如何落成图像，图上的位置又怎样重新解释为稳定性、快慢与振荡趋势。资源不为“画得更满”服务，而是为两大条件、完整法则、广义根轨迹和动态翻译提供清楚、可靠的视觉支撑。

---

## 一、资源概览

| 编号 | 文件名 | 类型 | 当前状态 | 主要用途 |
|:---:|---|---|:---:|---|
| 1 | `3-3-cover-comic.png` | 讲义封面图 | 已完成 | 提出“为什么只知道稳定区间还不够” |
| 2 | `3-3-info.png` | 信息图 | 已完成 | 收束本课主线，也供知识卡片复用 |
| 3 | `3-3-pp-01-root-locus-roadmap.svg` | 结构图 | 已完成 | 概括“参数变化 -> 根轨迹 -> 动态解释”的方法链 |
| 4 | `3-3-pp-02-generalized-root-locus-map.svg` | 结构图 | 已完成 | 说明普通根轨迹与广义根轨迹的关系 |
| 5 | `3-3-pp-03-angle-and-magnitude-geometry.svg` | 法则示意图 | 已完成 | 把相角条件与幅值条件放回复平面几何场景 |
| 6 | `3-3-pp-04-complete-rules-example.svg` | 主例图 | 已完成 | 统一承载完整法则的骨架与关键节点 |
| 7 | `3-3-pp-05-real-axis-parity.svg` | 法则示意图 | 已完成 | 单独解释实轴区段的奇偶判断 |
| 8 | `3-3-pp-06-departure-arrival-angle.svg` | 法则示意图 | 已完成 | 呈现复极点、复零点附近的切线方向 |
| 9 | `3-3-pp-07-generalized-time-constant-example.svg` | 例题图 | 已完成 | 展示时间常数参数如何改写成广义根轨迹问题 |
| 10 | `3-3-pp-08-dynamics-translation.svg` | 动态解释图 | 已完成 | 把根轨迹位置重新翻译为系统动态 |

---

## 二、各图承担的解释任务

- `3-3-cover-comic.png` 不负责公式解释，只负责把“稳定边界之后还有整条迁移路径”这一问题提出来。
- `3-3-info.png` 用于结尾收束，把本课的概念关系重新整理为一张可回看的信息图。
- `3-3-pp-01-root-locus-roadmap.svg` 适合放在教师组织课堂或知识卡片概括时使用，帮助学生先看见总路径。
- `3-3-pp-02-generalized-root-locus-map.svg` 负责解释总视角：普通增益根轨迹不是孤立工具，而是广义根轨迹中的一个特例。
- `3-3-pp-03-angle-and-magnitude-geometry.svg` 把两大条件放进同一张复平面图里，便于建立“先判资格，再定参数”的顺序。
- `3-3-pp-04-complete-rules-example.svg` 是全课主图。起点终点、实轴区段、渐近线、分离点和虚轴交点都应尽量回到这一图上讲。
- `3-3-pp-05-real-axis-parity.svg` 专门放大“右侧奇数个”的判断动作，避免学生在主图里看不清规则落点。
- `3-3-pp-06-departure-arrival-angle.svg` 用来说明局部切线方向，帮助学生理解起始角与终止角为何是局部修正而非全局骨架。
- `3-3-pp-07-generalized-time-constant-example.svg` 负责展示“原方程 -> 等效开环 -> 根轨迹 -> 动态变化”的完整过渡。
- `3-3-pp-08-dynamics-translation.svg` 负责最后一步：把轨迹重新翻回稳定性、快慢与振荡判断。

---

## 三、成图说明与源文件

本单元资源已经形成一套较稳定的表达分工：

- 结构关系图与法则示意图优先使用 SVG，以便保证公式、连线与标注清楚。
- 涉及根轨迹数值曲线的主例图与参数例图，先由 `Octave` 生成轨迹数据，再统一排版，重点保证起点、分离点与虚轴附近的曲线连续性。
- 所有正式图片都已复核公式可读性、标注遮挡、轨迹平滑度与边界裁切情况，当前版本可直接供讲义与知识卡片引用。

相关原始文件如下：

- `media/raw/3-3-cover-comic-prompt.md`
- `media/raw/3-3-cover-source.svg`
- `media/raw/3-3-info-source.svg`
- `media/raw/3-3-generate-plot-data.m`
- `media/raw/3-3-generate-panels.py`
- `media/raw/3-3-plot-data.json`

---

## 四、文本引用位置

- `handout.md` 首页：`3-3-cover-comic.png`
- `2.4-2.5`：`3-3-pp-03-angle-and-magnitude-geometry.svg`
- `3.1-3.6`：`3-3-pp-04-complete-rules-example.svg`
- `3.3`：`3-3-pp-05-real-axis-parity.svg`
- `3.7`：`3-3-pp-06-departure-arrival-angle.svg`
- `4.3` 与 `4.5`：`3-3-pp-07-generalized-time-constant-example.svg`
- `4.4`：`3-3-pp-02-generalized-root-locus-map.svg`
- `5.3-5.4`：`3-3-pp-08-dynamics-translation.svg`
- 结尾与知识卡片复用：`3-3-info.png`

---

## 五、后续可延展的方向

- 若转入互动课，可把 `3-3-pp-04-complete-rules-example.svg` 拆成逐法则显隐版，配合课堂分步讲解。
- 若与题库联动，可在 `3-3-pp-07-generalized-time-constant-example.svg` 基础上继续补参数滑动与极点动画版本。
- 若 `3-4` 需要更强的读图训练，可追加一张叠加阻尼比线与自然频率圆的辅助图，强化参数窗口判断。
