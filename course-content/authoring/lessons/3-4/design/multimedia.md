# 单元 3-4 多媒体设计与采用清单

## 1. 本课媒体主线

`3-4` 的多媒体不追求“再做一套更花哨的图”，而要服务一条十分明确的课堂判断链。学生在这节课里真正需要的，不是更多信息，而是更清楚的证据：哪一张图负责把主图骨架讲明，哪一张图负责把窗口语言讲稳，哪一张图负责把图上的判断落回对象后果。

因此，本课媒体始终围绕五件事组织：

1. 让 `3-3` 的法则骨架压缩成一张可直接阅读的主图；
2. 让“稳定窗口”和“可接受窗口”的区别一眼可见；
3. 让 `根轨迹增益 -> 实际控制器增益` 的换算关系不再含混；
4. 让时域与频域结果为主图判断补上对象化证据；
5. 让局部负反馈位置与广义参数迁移被看成结构变化，而不是零散公式。

换言之，本课媒体不是装饰层，而是读图、换算与验证这三步动作的可视化支撑。

## 2. 已有成品与落点

下列成品已经构成 `3-4` 的主媒体骨架。它们的价值，不在于数量，而在于各自承担的阅读职责足够清楚。

| 文件 | 类型 | 当前状态 | 主要落点 | 用途说明 |
| --- | --- | --- | --- | --- |
| `3-4-cover-comic.png` | 代码生成封面图 | 已完成 | `handout.md` 首页 | 以“稳定了是否就够好”打开本课问题 |
| `3-4-intro-video.mp4` | 导入短视频 | 已完成 | `boppps.md` / `interactive-page.md` 步骤 1 | 用最短时间建立情境冲突 |
| `3-4-root-locus-summary.png` | 主图总览 | 已完成 | 讲义正文 / 教师版 / 互动页步骤 5 | 作为整节课不断回返的统一主图 |
| `3-4-root-locus-keynodes.png` | 关键节点标注图 | 已完成 | 讲义正文 / 互动页步骤 7 | 支持分离点、虚轴交点、主导极点候选的定位与记录 |
| `3-4-root-locus-reference-b.png` | 参考工作点图 | 已完成 | 讲义正文 / 教师版 / 卡片 | 说明 B 版本为何能被读成参考工作点 |
| `3-4-conditional-stability-window.png` | 参数窗口图 | 已完成 | 讲义正文 / 互动页步骤 8 | 把“稳定窗口”和“可接受窗口”区别开来 |
| `3-4-step-compare.png` | 时域对比图 | 本题重制 | 讲义正文 / 互动页步骤 10 | 用本题 `Octave` 数据展示原系统与主导极点近似的阶跃对照 |
| `3-4-bode-compare.png` | 频域对比图 | 已完成 | 讲义正文 / 互动页步骤 12 | 支持对象化频域验证，让风险先于失稳暴露 |
| `3-4-local-feedback-block.png` | 局部反馈框图 | 本轮新增 | 讲义正文 §5.2 / 教师版 | 说明局部负反馈只围绕 $G_1(s)$，不改外环单位反馈位置 |
| `3-4-generalized-root-locus.png` | 广义根轨迹图 | 本轮新增 | 讲义正文 §5.3 / 教师版 | 展示局部反馈系数 $a$ 增大时快极点分支与主导极点窗口的联动变化 |
| `3-4-dominant-pole-selection.png` | 主导极点可信性图 | 已完成 | 讲义正文 / 教师版 / 互动页步骤 11 | 说明 B 版本为何仍可用主导极点近似抓住主要动态，并提醒高频细节不能被省略 |
| `3-4-info.png` | 课末信息图 | 已完成 | `handout.md` 附录前 | 用一张总结图收束全课 |

## 3. 本轮补齐的新媒体

这次新增的媒体不多，但都直接服务课堂中最容易含混的地方。

| 文件 | 类型 | 状态 | 用途 |
| --- | --- | --- | --- |
| `3-4-gain-conversion-card.png` | 代码生成信息卡 | 本轮新增 | 把 `k -> K` 的换算链做成可直接调用的纠偏卡片，用于互动页步骤 9 与教师集中纠偏 |
| `3-4-cover-comic-prompt.md` | AI 提示词 | 本轮新增 | 保存封面漫画的提示词真源，便于后续按同一问题意识重绘 |

这两项新增都不承担主图职责。前者只负责换算关系，后者只负责保留生成来源，不能反客为主地取代课堂正文中的关键图示。

## 4. 本轮重制的验证图

本轮重制聚焦在“把对象后果看得更具体”，因此主要落在连续跟踪与航迹对照图上。

| 文件 | 状态 | 版式要求 | 说明 |
| --- | --- | --- | --- |
| `3-4-turning-track-k06064.png` | 本题重制 | 保持“左斜坡响应、右航迹”双栏版式 | 用 B 版本说明参考工作点在连续跟踪任务中的滞后与航迹偏差 |
| `3-4-turning-track-k20.png` | 本题重制 | 保持“左斜坡响应、右航迹”双栏版式 | 用 C 版本说明跟踪改善与频域代价并存 |

这两张图的重要性，在于把“参数更大以后到底换来了什么、又牺牲了什么”写成可见的对象后果，而不是把判断停在复平面上。

## 5. 产物级映射

### 5.1 讲义

学生讲义中的媒体安排，应始终沿着“提出问题 -> 读主图 -> 判窗口 -> 做验证 -> 收束总结”的顺序展开：

- 首页：`3-4-cover-comic.png`
- 正文主图：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参数窗口：`3-4-conditional-stability-window.png`
- 时域/频域验证：`3-4-step-compare.png`、`3-4-bode-compare.png`
- 连续跟踪验证：`3-4-turning-track-k06064.png`、`3-4-turning-track-k20.png`
- 广义参数：`3-4-local-feedback-block.png`、`3-4-generalized-root-locus.png`
- 课末收束：`3-4-info.png`

### 5.2 教师版讲义

教师版不需要比学生版“更多图”，而需要更明确地知道每张图在课堂的哪一个时刻出场：

- 主图总览：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参考工作点：`3-4-root-locus-reference-b.png`
- 窗口判断：`3-4-conditional-stability-window.png`
- 时域/频域回查：`3-4-step-compare.png`、`3-4-bode-compare.png`
- 斜坡/航迹回查：`3-4-turning-track-k06064.png`、`3-4-turning-track-k20.png`
- 局部反馈与广义参数：`3-4-local-feedback-block.png`、`3-4-generalized-root-locus.png`
- 主导极点可信性：`3-4-dominant-pole-selection.png`

### 5.3 互动页

互动页中的媒体调用应服务页面动作，而不是平铺展示：

- 步骤 1：`3-4-intro-video.mp4` / `3-4-cover-comic.png`
- 步骤 5：`3-4-root-locus-summary.png`
- 步骤 7：`3-4-root-locus-keynodes.png`
- 步骤 8：`3-4-conditional-stability-window.png`
- 步骤 9：`3-4-gain-conversion-card.png`
- 步骤 10：`3-4-step-compare.png`
- 步骤 11：`3-4-dominant-pole-selection.png`
- 步骤 12：`3-4-bode-compare.png`

## 6. 版面与阅读原则

本课多媒体虽然种类较多，但真正需要守住的是阅读关系。

- `3-4-step-compare.png` 尺寸较小，讲义与教师版都应控制宽度，避免直接铺满整栏。
- `3-4-bode-compare.png` 信息密度高，互动页应默认提供放大查看态，不宜在窄列中硬塞。
- `3-4-turning-track-k06064.png` 与 `3-4-turning-track-k20.png` 必须保持“左斜坡响应、右航迹”的双栏关系，不改成上下堆叠。
- `3-4-generalized-root-locus.png` 必须保留“全局快极点分支 + 主导极点局部放大”的双重阅读结构。
- `3-4-gain-conversion-card.png` 只服务换算关系，不能误当作主图或主结论图使用。

## 7. 命名与来源

本课所有正式媒体统一使用 `3-4-` 前缀。曲线、轨迹与对比图由 `media/raw/generate_figures.m` 与 `render_figures.py` 链路产出；局部负反馈框图由 `media/raw/3-4-local-feedback-block.tex` 与 `generate_local_feedback_block.py` 生成；封面图与换算卡属于本地代码直出的信息图。媒体来源应保持可追溯，但追溯信息不应反过来挤占正文的阅读空间。
