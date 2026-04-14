# 单元 3-4 多媒体设计与采用清单

## 1. 本课媒体主线

`3-4` 的多媒体不追求“再做一套炫图”，而是服务三件事：

1. 把 `3-3` 的法则骨架压成可直接读的主图；
2. 把“稳定窗口 vs 可接受窗口”做成一眼能区分的判断辅助图；
3. 把主图结论用时域与频域结果闭合成证据链。
4. 把局部负反馈位置与广义根轨迹变化补成可直接阅读的结构图和参数图。

因此，本课媒体组织必须围绕：

- 关键节点读图；
- 参数窗口判断；
- 根轨迹增益换算；
- 对象化三域验证。
- 局部负反馈与广义参数迁移。

## 2. 已有成品与落点

| 文件 | 类型 | 当前状态 | 主要落点 | 用途说明 |
|------|------|----------|----------|----------|
| `3-4-cover-comic.png` | 代码生成封面图 | 已完成 | `handout.md` 首页 | 讲义导入封面，提出“稳定了是否就够好”的问题 |
| `3-4-intro-video.mp4` | 导入短视频 | 已完成 | `boppps.md` / `interactive-page.md` 步骤1 | 课堂导入，快速建立情境冲突 |
| `3-4-root-locus-summary.png` | 主图总览 | 已完成 | 讲义正文 / 教师版 / 互动页步骤5 | 本课统一主图，所有判断回到这张图 |
| `3-4-root-locus-keynodes.png` | 关键节点标注图 | 已完成 | 讲义正文 / 互动页步骤7 | 支持分离点、虚轴交点、主导极点候选定位 |
| `3-4-root-locus-reference-b.png` | 参考工作点图 | 已完成 | 讲义正文 / 教师版 / 卡片 | 说明 B 版本为什么是参考工作点 |
| `3-4-conditional-stability-window.png` | 参数窗口图 | 已完成 | 讲义正文 / 互动页步骤8 | 区分稳定窗口与可接受窗口 |
| `3-4-step-compare.png` | 时域对比图 | 本题重制 | 讲义正文 / 互动页步骤11 | 用本题 `Octave` 数据重制 B 版本原系统与主导极点近似的阶跃响应对比 |
| `3-4-bode-compare.png` | 频域对比图 | 已完成 | 讲义正文 / 互动页步骤12 | 支持对象化频域验证 |
| `3-4-local-feedback-block.png` | 局部反馈框图 | 本轮新增 | 讲义正文 §5.2 / 教师版 | 明确局部负反馈只围绕 $G_1(s)$，不改外环单位反馈位置 |
| `3-4-generalized-root-locus.png` | 广义根轨迹图 | 本轮新增 | 讲义正文 §5.3 / 教师版 | 说明局部反馈系数 $a$ 增大时快极点分支与主导极点窗口如何同时变化 |
| `3-4-dominant-pole-selection.png` | 主导极点可信性图 | 已完成 | 讲义正文 / 教师版 | 支撑 B 版本主导极点近似可信 |
| `3-4-info.png` | 课末信息图 | 已完成 | `handout.md` 附录前 | 课末总图收束 |

## 3. 本轮补齐的新媒体

| 文件 | 类型 | 状态 | 用途 |
|------|------|------|------|
| `3-4-gain-conversion-card.png` | 代码生成信息卡 | 本轮新增 | 明确 `k -> K` 的换算链，用于互动页步骤9和教师纠偏 |
| `3-4-cover-comic-prompt.md` | AI 提示词 | 本轮新增 | 保留封面漫画的提示词真源，后续如需 AI 重绘可直接使用 |

## 4. 本轮重制的验证图

| 文件 | 状态 | 版式要求 | 说明 |
|------|------|----------|------|
| `3-4-turning-track-k06064.png` | 本题重制 | 保持“左斜坡响应、右航迹”双栏版式 | B 版本用于说明参考工作点在连续跟踪任务中的滞后与航迹偏差 |
| `3-4-turning-track-k20.png` | 本题重制 | 保持“左斜坡响应、右航迹”双栏版式 | C 版本用于说明跟踪改善与频域代价并存 |

## 5. 产物级映射

### 5.1 讲义

- 首页：`3-4-cover-comic.png`
- 正文主图：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参数窗口：`3-4-conditional-stability-window.png`
- 时域/频域验证：`3-4-step-compare.png`、`3-4-bode-compare.png`
- 连续跟踪验证：`3-4-turning-track-k06064.png`、`3-4-turning-track-k20.png`
- 广义参数：`3-4-local-feedback-block.png`、`3-4-generalized-root-locus.png`
- 课末收束：`3-4-info.png`

### 5.2 教师版讲义

- 主图总览：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参考工作点：`3-4-root-locus-reference-b.png`
- 窗口判断：`3-4-conditional-stability-window.png`
- 时域/频域回查：`3-4-step-compare.png`、`3-4-bode-compare.png`
- 斜坡/航迹回查：`3-4-turning-track-k06064.png`、`3-4-turning-track-k20.png`
- 局部反馈与广义参数：`3-4-local-feedback-block.png`、`3-4-generalized-root-locus.png`
- 主导极点可信性：`3-4-dominant-pole-selection.png`

### 5.3 互动页

- 步骤 1：`3-4-intro-video.mp4` / `3-4-cover-comic.png`
- 步骤 5：`3-4-root-locus-summary.png`
- 步骤 7：`3-4-root-locus-keynodes.png`
- 步骤 8：`3-4-conditional-stability-window.png`
- 步骤 9：`3-4-gain-conversion-card.png`
- 步骤 11：`3-4-step-compare.png`
- 步骤 12：`3-4-bode-compare.png`

## 6. 仍需注意的版面原则

- `3-4-step-compare.png` 尺寸较小，讲义和教师版使用时应控制宽度，避免直接铺满整栏。
- `3-4-bode-compare.png` 信息密度高，互动页默认使用可放大查看态，不建议在窄列中硬塞。
- `3-4-turning-track-k06064.png` 与 `3-4-turning-track-k20.png` 必须保持左侧斜坡响应、右侧航迹图的双栏结构，不改成上下堆叠。
- `3-4-generalized-root-locus.png` 需要保留“全局快极点分支 + 主导极点局部放大”的双重阅读关系。
- `3-4-gain-conversion-card.png` 只服务换算链，不应误当成主图或主结论图。

## 7. 命名与来源

- 本课所有正式媒体均统一使用 `3-4-` 前缀。
- 曲线、轨迹与对比图由 `media/raw/generate_figures.m` 与 `render_figures.py` 链路产出。
- 局部负反馈框图由 `media/raw/3-4-local-feedback-block.tex` 与 `generate_local_feedback_block.py` 生成。
- 封面图与换算卡由本地代码生成，属于“代码直出信息图”。
