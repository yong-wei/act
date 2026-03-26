# 多模态资源设计 | 单元 2-4：Nyquist图与频域指标入口——从第一层图形到复平面与裕度语言

> **资源总数**：16 项  
> **当前完成**：12 项（封面图、信息图、`fd-01` 至 `fd-10`）  
> **待制作**：4 项（`2-4-slides.pdf`、`2-4-intro-video.mp4`、`2-4-course.mp4`、`2-4-audio.m4a`）  
> **本轮状态**：已统一全部正式媒体命名为 `2-4-` 前缀，并补齐学生版讲义导出所需的 `2-4-cover-comic.png` 与 `2-4-info.png`。  
> **核心约定**：涉及频域曲线、响应曲线和性能指标的数值校验，统一使用 `Octave + control` 包原生函数完成，例如 `tf`、`bode`、`bodemag`、`nyquist`、`step`、`impulse`、`margin`、`feedback`；不自造基础计算函数。

---

## 1. 正式命名与目录约束

- 所有正式媒体一律使用 `[单元编号]-{资源名}` 命名，本单元固定为 `2-4-...`
- 讲义封面图：`2-4-cover-comic.png`
- 讲义信息图：`2-4-info.png`
- 生成式课件：`2-4-slides.pdf`
- 课程导入视频：`2-4-intro-video.mp4`
- 课程内容视频：`2-4-course.mp4`
- 课程音频播客：`2-4-audio.m4a`
- 代码直出图与线框图：`2-4-fd-01-...` 至 `2-4-fd-10-...`
- 原料目录固定为 `media/raw/`，成品目录固定为 `media/processed/`
- `handout.md`、`multimedia.md`、原料脚本默认输出名必须与上述成品命名完全一致

---

## 2. 资源总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 |
|:---:|---|---|:---:|---|
| 1 | `2-4-cover-comic.png` | 讲义封面图 | 已完成 | `handout.md` 首页导入 |
| 2 | `2-4-info.png` | 讲义信息图 | 已完成 | `handout.md` 附录前总结 |
| 3 | `2-4-slides.pdf` | 生成式课件 | 待制作 | 课堂投屏 / 课件归档 |
| 4 | `2-4-intro-video.mp4` | 导入视频 | 待制作 | 课堂开场 / 互动课首页 |
| 5 | `2-4-course.mp4` | 课程内容视频 | 待制作 | 课程视频归档 |
| 6 | `2-4-audio.m4a` | 课程音频播客 | 待制作 | 音频归档 / 播客分发 |
| 7 | `2-4-fd-01-bode-dual-view-overview.png` | 线框概念图 | 已完成 | `handout` §2.2 |
| 8 | `2-4-fd-02-log-frequency-db-intuition.png` | 线框概念图 | 已完成 | `handout` §2.3 / §2.3.1 / 附录A |
| 9 | `2-4-fd-03-typical-elements-bode-comparison.svg` | 代码直出图 | 已完成 | `handout` §2.4 / §2.10 / 附录B |
| 10 | `2-4-fd-04-first-order-exact-vs-asymptote.svg` | 代码直出图 | 已完成 | `handout` §2.5 / 附录C |
| 11 | `2-4-fd-05-first-order-nyquist-track.svg` | 代码直出图 | 已完成 | `handout` §2.6 / §2.7 / 例题二 |
| 12 | `2-4-fd-06-pure-pole-nyquist-comparison.svg` | 代码直出图 | 已完成 | `handout` §2.7 / 附录B |
| 13 | `2-4-fd-07-second-order-damping-bode.svg` | 代码直出图 | 已完成 | `handout` §2.4.4 / 附录D |
| 14 | `2-4-fd-08-bode-nyquist-consistency-panel.svg` | 代码直出图 | 已完成 | `handout` §2.8 / 工程视角 |
| 15 | `2-4-fd-09-bode-sketch-checklist.png` | 线框流程图 | 已完成 | `handout` §2.9 / 附录C |
| 16 | `2-4-fd-10-nyquist-sketch-checklist.png` | 线框流程图 | 已完成 | `handout` §2.9 / 附录C |

---

## 3. 课程级媒体

### 3.1 已完成

| 资源 | 原料 | 成品 | 说明 |
|---|---|---|---|
| 封面漫画 | `media/raw/2-4-cover-comic-prompt.md` | `media/processed/2-4-cover-comic.png` | 学生版讲义首页导入图，突出“从逐点计算过渡到整体读图” |
| 信息图 | 无独立提示词文件 | `media/processed/2-4-info.png` | 讲义附录前总结图，压缩本讲主线、Bode/Nyquist 对照与手绘顺序 |

### 3.2 待制作

| 资源 | 正式文件名 | 当前说明 |
|---|---|---|
| 生成式课件 | `media/processed/2-4-slides.pdf` | 待在学生版讲义定稿后生成，与讲义同口径 |
| 导入视频 | `media/processed/2-4-intro-video.mp4` | 待根据本讲“为什么要把频率特性画成图”主线制作 |
| 课程视频 | `media/processed/2-4-course.mp4` | 待课堂讲授脚本稳定后制作 |
| 音频播客 | `media/processed/2-4-audio.m4a` | 待课程视频或讲义旁白定稿后制作 |

---

## 4. 代码直出图与线框图映射

| 标识 | 原料文件 | 成品文件 | 工具 | 核心用途 |
|---|---|---|---|---|
| `fd-01` | `media/raw/2-4-fd-01-bode-dual-view-overview.tex` | `media/processed/2-4-fd-01-bode-dual-view-overview.png` | TikZ | 说明 Bode 图是“幅频图 + 相频图”双图结构 |
| `fd-02` | `media/raw/2-4-fd-02-log-frequency-db-intuition.tex` | `media/processed/2-4-fd-02-log-frequency-db-intuition.png` | TikZ | 说明对数频率轴与 dB 的读图直觉 |
| `fd-03` | `media/raw/2-4-fd-03-typical-elements-bode-comparison.m` | `media/processed/2-4-fd-03-typical-elements-bode-comparison.svg` | Octave | 典型环节 Bode 图总览对照 |
| `fd-04` | `media/raw/2-4-fd-04-first-order-exact-vs-asymptote.m` | `media/processed/2-4-fd-04-first-order-exact-vs-asymptote.svg` | Octave | 一阶惯性精确曲线与渐近骨架对照 |
| `fd-05` | `media/raw/2-4-fd-05-first-order-nyquist-track.m` | `media/processed/2-4-fd-05-first-order-nyquist-track.svg` | Octave | 一阶惯性 Nyquist 轨迹与方向感 |
| `fd-06` | `media/raw/2-4-fd-06-pure-pole-nyquist-comparison.m` | `media/processed/2-4-fd-06-pure-pole-nyquist-comparison.svg` | Octave | 纯极点 Nyquist 阶次对照 |
| `fd-07` | `media/raw/2-4-fd-07-second-order-damping-bode.m` | `media/processed/2-4-fd-07-second-order-damping-bode.svg` | Octave | 二阶振荡环节的阻尼变化观察 |
| `fd-08` | `media/raw/2-4-fd-08-bode-nyquist-consistency-panel.m` | `media/processed/2-4-fd-08-bode-nyquist-consistency-panel.svg` | Octave | 同一对象的 Bode / Nyquist 一致性 |
| `fd-09` | `media/raw/2-4-fd-09-bode-sketch-checklist.tex` | `media/processed/2-4-fd-09-bode-sketch-checklist.png` | TikZ | Bode 图手绘步骤检查单 |
| `fd-10` | `media/raw/2-4-fd-10-nyquist-sketch-checklist.tex` | `media/processed/2-4-fd-10-nyquist-sketch-checklist.png` | TikZ | Nyquist 图手绘步骤检查单 |

---

## 5. 制作与回写要求

- 原料脚本导出的默认文件名必须直接落到 `2-4-...` 正式文件名，不允许先生成 `fd-03-...` 再手工改名
- 讲义中的媒体引用必须只使用 `../media/processed/2-4-...`，不保留旧命名兼容层
- 新增媒体时，优先补齐 `multimedia.md` 资源总表，再生成原料与成品
- 若后续补做 `slides / intro-video / course / audio`，必须沿用本文件中的正式命名，不另开无前缀版本
