# 单元 3-4 多媒体设计与采用清单

## 1. 本课媒体主线

`3-4` 的多媒体不追求“再做一套炫图”，而是服务三件事：

1. 把 `3-3` 的法则骨架压成可直接读的主图；
2. 把“稳定窗口 vs 可接受窗口”做成一眼能区分的判断辅助图；
3. 把主图结论用时域与频域结果闭合成证据链。

因此，本课媒体组织必须围绕：

- 关键节点读图；
- 参数窗口判断；
- 根轨迹增益换算；
- 对象化三域验证。

## 2. 已有成品与落点

| 文件 | 类型 | 当前状态 | 主要落点 | 用途说明 |
|------|------|----------|----------|----------|
| `3-4-cover-comic.png` | 代码生成封面图 | 已完成 | `handout.md` 首页 | 讲义导入封面，提出“稳定了是否就够好”的问题 |
| `3-4-intro-video.mp4` | 导入短视频 | 已完成 | `boppps.md` / `interactive-page.md` 步骤1 | 课堂导入，快速建立情境冲突 |
| `3-4-root-locus-summary.png` | 主图总览 | 已完成 | 讲义正文 / 教师版 / 互动页步骤5 | 本课统一主图，所有判断回到这张图 |
| `3-4-root-locus-keynodes.png` | 关键节点标注图 | 已完成 | 讲义正文 / 互动页步骤7 | 支持分离点、虚轴交点、主导极点候选定位 |
| `3-4-root-locus-reference-b.png` | 参考工作点图 | 已完成 | 讲义正文 / 教师版 / 卡片 | 说明 B 版本为什么是参考工作点 |
| `3-4-conditional-stability-window.png` | 参数窗口图 | 已完成 | 讲义正文 / 互动页步骤8 | 区分稳定窗口与可接受窗口 |
| `3-4-step-compare.png` | 时域对比图 | 已完成 | 讲义正文 / 互动页步骤11 | 支持对象化时域验证 |
| `3-4-bode-compare.png` | 频域对比图 | 已完成 | 讲义正文 / 互动页步骤12 | 支持对象化频域验证 |
| `3-4-dominant-pole-selection.png` | 主导极点可信性图 | 已完成 | 讲义正文 / 教师版 | 支撑 B 版本主导极点近似可信 |
| `3-4-info.png` | 课末信息图 | 已完成 | `handout.md` 附录前 | 课末总图收束 |

## 3. 本轮补齐的新媒体

| 文件 | 类型 | 状态 | 用途 |
|------|------|------|------|
| `3-4-gain-conversion-card.png` | 代码生成信息卡 | 本轮新增 | 明确 `k -> K` 的换算链，用于互动页步骤9和教师纠偏 |
| `3-4-cover-comic-prompt.md` | AI 提示词 | 本轮新增 | 保留封面漫画的提示词真源，后续如需 AI 重绘可直接使用 |

## 4. 可复用但本课不强制前台展示的素材

| 文件 | 采用方式 | 边界说明 |
|------|----------|----------|
| `3-4-turning-track-k06064.png` | 可选复用 | 适合作为教师补充说明 B 版本的航向轨迹，不列为学生默认主工作区 |
| `3-4-turning-track-k20.png` | 可选复用 | 适合作为教师补充说明 C 版本的风险感，不列为学生默认主工作区 |

## 5. 产物级映射

### 5.1 讲义

- 首页：`3-4-cover-comic.png`
- 正文主图：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参数窗口：`3-4-conditional-stability-window.png`
- 时域/频域验证：`3-4-step-compare.png`、`3-4-bode-compare.png`
- 课末收束：`3-4-info.png`

### 5.2 教师版讲义

- 主图总览：`3-4-root-locus-summary.png`
- 关键节点：`3-4-root-locus-keynodes.png`
- 参考工作点：`3-4-root-locus-reference-b.png`
- 窗口判断：`3-4-conditional-stability-window.png`
- 时域/频域回查：`3-4-step-compare.png`、`3-4-bode-compare.png`
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
- `3-4-gain-conversion-card.png` 只服务换算链，不应误当成主图或主结论图。

## 7. 命名与来源

- 本课所有正式媒体均统一使用 `3-4-` 前缀。
- 曲线、轨迹与对比图由 `media/raw/generate_figures.m` 与 `render_figures.py` 链路产出。
- 封面图与换算卡由本地代码生成，属于“代码直出信息图”。
