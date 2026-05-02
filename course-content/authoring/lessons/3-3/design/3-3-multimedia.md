# 多模态资源设计 | 单元 3-3：根轨迹机制与完整法则——为什么参数变化会推动闭环极点迁移

本单元的图像资源只服务当前 15 步主线：参数变化如何变成闭环极点迁移，两大条件怎样进入判断，骨架法则和关键节点怎样落回图像，最后又怎样读回稳定性、快慢与振荡趋势。资源不为“画得更满”服务，而是为当前讲义中的条件、法则、三组例题与读图顺序提供清楚、可靠的视觉支撑。

---

## 一、资源概览

| 编号 | 文件名 | 类型 | 当前状态 | 主要用途 |
|:---:|---|---|:---:|---|
| 1 | `3-3-cover-comic.png` | 讲义封面图 | 已完成 | 提出“为什么只知道稳定区间还不够” |
| 2 | `3-3-info.png` | 信息图 | 已完成 | 收束本课主线，也供知识卡片复用 |
| 3 | `3-3-pp-01-root-locus-roadmap.svg` | 结构图 | 已完成 | 概括“参数变化 -> 根轨迹 -> 动态解释”的方法链 |
| 4 | `3-3-pp-03-angle-and-magnitude-geometry.svg` | 法则示意图 | 已完成 | 把相角条件与幅值条件放回复平面几何场景 |
| 5 | `3-3-pp-04-complete-rules-example.svg` | 主例图 | 已完成 | 统一承载完整法则的骨架与关键节点 |
| 6 | `3-3-pp-05-real-axis-parity.svg` | 法则示意图 | 已完成 | 单独解释实轴区段的奇偶判断 |
| 7 | `3-3-pp-06-departure-arrival-angle.svg` | 法则示意图 | 已完成 | 呈现复极点、复零点附近的局部方向 |
| 8 | `3-3-example-01-skeleton.svg` | 例题图 | 已完成 | 例题 1 的骨架法则读图 |
| 9 | `3-3-example-02-breakaway-crossing.svg` | 例题图 | 已完成 | 例题 2 的分离点与虚轴交点 |
| 10 | `3-3-example-03-departure-sum.svg` | 例题图 | 已完成 | 例题 3 的出射角与根之和校核 |

---

## 二、各图承担的解释任务

- `3-3-cover-comic.png` 不负责公式解释，只负责把“稳定边界之后还有整条迁移路径”这一问题提出来。
- `3-3-info.png` 用于结尾收束，把本课的概念关系重新整理为一张可回看的信息图。
- `3-3-pp-01-root-locus-roadmap.svg` 适合放在教师组织课堂或知识卡片概括时使用，帮助学生先看见总路径。
- `3-3-pp-03-angle-and-magnitude-geometry.svg` 把两大条件放进同一张复平面图里，便于建立“先判资格，再定参数”的顺序。
- `3-3-pp-04-complete-rules-example.svg` 是全课主图。起点终点、实轴区段、渐近线、分离点和虚轴交点都应尽量回到这一图上讲。
- `3-3-pp-05-real-axis-parity.svg` 专门放大“右侧奇数个”的判断动作，避免学生在主图里看不清规则落点。
- `3-3-pp-06-departure-arrival-angle.svg` 用来说明局部切线方向，帮助学生理解出射角与入射角为何是局部修正而非全局骨架。
- `3-3-example-01-skeleton.svg` 对应例题 1，负责承载骨架法则如何先搭出整图。
- `3-3-example-02-breakaway-crossing.svg` 对应例题 2，负责区分分离点与虚轴交点各自回答的问题。
- `3-3-example-03-departure-sum.svg` 对应例题 3，负责展示局部出射角与整图根之和怎样同时成立。

---

## 三、成图说明与源文件

本单元资源已经形成一套稳定分工：

- 结构关系图与法则示意图优先使用 SVG，以保证公式、连线与标注清楚。
- 涉及根轨迹曲线的主例图与例题图，先由 `Octave` 生成轨迹数据，再统一排版，重点保证起点、分离点与虚轴附近的曲线连续性。
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
- 条件与几何解释：`3-3-pp-03-angle-and-magnitude-geometry.svg`
- 完整法则主图：`3-3-pp-04-complete-rules-example.svg`
- 实轴区段：`3-3-pp-05-real-axis-parity.svg`
- 出射角与入射角：`3-3-pp-06-departure-arrival-angle.svg`
- 例题 1：`3-3-example-01-skeleton.svg`
- 例题 2：`3-3-example-02-breakaway-crossing.svg`
- 例题 3：`3-3-example-03-departure-sum.svg`
- 结尾与知识卡片复用：`3-3-info.png`

---

## 五、后续可延展的方向

- 若继续强化互动课，可把 `3-3-pp-04-complete-rules-example.svg` 拆成逐法则显隐版，配合课堂分步讲解。
- 若与题库联动，可在三组例题图基础上补参数滑动与极点动画版本。
- 若 `3-4` 需要更强的读图训练，可追加一张叠加阻尼比线与自然频率圆的辅助图，强化参数窗口判断。
