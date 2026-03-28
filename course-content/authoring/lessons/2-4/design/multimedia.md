# 多模态资源设计 | 单元 2-4：Nyquist图与频域指标入口——把 Bode 图收束为轨迹、裕度与反向识别

> **资源总数**：16 项正式媒体 + 1 项验证脚本
> **当前完成**：12 项正式媒体（封面图、信息图、`fd-01` 至 `fd-10`）
> **待补齐**：4 项课程级交付（`2-4-slides.pdf`、`2-4-intro-video.mp4`、`2-4-course.mp4`、`2-4-audio.m4a`）
> **本轮重点**：按新骨架重排 `2-4` 的资源采用逻辑，使媒体真正服务 `Nyquist` 图入口、频域指标入口和最小反向识别，而不再回头重讲 `2-3` 已完成的 Bode 基础。
> **验证约定**：讲义正文中新增的数值结论统一以 `python3 + control` 为真值来源；已有成图暂保留当前产物，后续如需重生，优先迁移到 `python3 + control` 链路。

---

## 1. 本课资源采用单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
|---|---|---|---|---|---|
| `course-content/resource-library/pptx/18幅相特性_换个角度看频域/README.md` | `pptx` | 讲义正文、互动页核心内容、BOPPPS 主体教学 | 改写吸收 | 必融入 | 本课主资源，服务 Nyquist 图定义、关键特征点、概略绘制步骤和 Bode/Nyquist 对照 |
| `course-content/resource-library/pptx/17近似叠加_绘制伯德图/README.md` | `pptx` | 讲义“手工绘图入口”、互动页检查单、后测 | 改写吸收 | 可选融入 | 只保留简单组合对象骨架和基础反识别提示，不再重讲 Bode 图基础 |
| `course-content/resource-library/pptx/16频率特性_换个角度看控制/README.md` | `pptx` | 讲义引入过渡 | 仅作灵感 | 可选融入 | 只帮助衔接 `2-3 -> 2-4`，不再承担本课主体内容 |
| `course-content/resource-library/pptx/19稳定判据_频域的启示/README.md` | `pptx` | 无 | 排除 | 排除 | 本课不进入 Nyquist 判据和 Bode 判稳，避免提前掏空 `3-8` |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | 无 | 排除 | 排除 | 容易把本课拉成工程结论课，更适合 `3-8 / 4-1` |
| `course-content/resource-library/ship-control-cases/sections/5.2-船舶横摇减摇鳍控制频域分析.md` | `ship-case` | 无 | 排除 | 排除 | 本课主线应保持标准对象与图形入口，不展开多场景频域比较 |
| `course-content/resource-library/ship-control-cases/sections/5.3-船载稳定平台控制系统频域分析.md` | `ship-case` | 无 | 排除 | 排除 | 与本课边界不匹配，留待模块3/4使用 |
| `course-content/resource-library/civics-cases/indexes/unit-mapping.md` | `civics` | 无 | 排除 | 排除 | 当前没有与 `2-4` 高匹配的自然嵌入点，本轮不强行接入 |

---

## 2. 正式命名与目录约束

- 所有正式媒体一律使用 `[单元编号]-{资源名}` 命名，本单元固定为 `2-4-...`
- 讲义封面图：`2-4-cover-comic.png`
- 讲义信息图：`2-4-info.png`
- 生成式课件：`2-4-slides.pdf`
- 课程导入视频：`2-4-intro-video.mp4`
- 课程内容视频：`2-4-course.mp4`
- 课程音频播客：`2-4-audio.m4a`
- 代码直出图与线框图：`2-4-fd-01-...` 至 `2-4-fd-10-...`
- 原料目录固定为 `media/raw/`，成品目录固定为 `media/processed/`
- 本轮新增验证脚本：`media/raw/2-4-fd-11-margin-entry.py`

---

## 3. 资源总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 |
|:---:|---|---|:---:|---|
| 1 | `2-4-cover-comic.png` | 讲义封面图 | 已完成 | `handout.md` 首页导入 |
| 2 | `2-4-info.png` | 讲义信息图 | 已完成 | `handout.md` 附录前总结 |
| 3 | `2-4-slides.pdf` | 生成式课件 | 待制作 | 课堂投屏 / 课件归档 |
| 4 | `2-4-intro-video.mp4` | 导入视频 | 待制作 | 课堂开场 / 互动课首页 |
| 5 | `2-4-course.mp4` | 课程内容视频 | 待制作 | 课程视频归档 |
| 6 | `2-4-audio.m4a` | 课程音频播客 | 待制作 | 音频归档 / 播客分发 |
| 7 | `2-4-fd-01-bode-dual-view-overview.png` | 线框概念图 | 已完成 | 备用：解释双图结构 |
| 8 | `2-4-fd-02-log-frequency-db-intuition.png` | 线框概念图 | 已完成 | 备用：仅在教师补充时引用 |
| 9 | `2-4-fd-03-typical-elements-bode-comparison.svg` | 代码直出图 | 已完成 | `handout` §七 / `interactive-page` 步骤10 |
| 10 | `2-4-fd-04-first-order-exact-vs-asymptote.svg` | 代码直出图 | 已完成 | 备用：简单组合对象骨架补充 |
| 11 | `2-4-fd-05-first-order-nyquist-track.svg` | 代码直出图 | 已完成 | `handout` §四 / `interactive-page` 步骤6 |
| 12 | `2-4-fd-06-pure-pole-nyquist-comparison.svg` | 代码直出图 | 已完成 | `handout` §四 / `interactive-page` 步骤6 |
| 13 | `2-4-fd-07-second-order-damping-bode.svg` | 代码直出图 | 已完成 | `handout` §七 / `interactive-page` 步骤10 |
| 14 | `2-4-fd-08-bode-nyquist-consistency-panel.svg` | 代码直出图 | 已完成 | `handout` §三、§五 / `interactive-page` 步骤2、8 |
| 15 | `2-4-fd-09-bode-sketch-checklist.png` | 线框流程图 | 已完成 | `handout` §六 / `interactive-page` 步骤9 |
| 16 | `2-4-fd-10-nyquist-sketch-checklist.png` | 线框流程图 | 已完成 | `handout` §六 / `interactive-page` 步骤9 |
| 17 | `2-4-fd-11-margin-entry.py` / `2-4-fd-11-margin-entry.m` | 验证脚本 | 已完成 | `handout` 附录D，例题三数值核对与学生复现 |

---

## 4. 课程级媒体

### 4.1 已完成

| 资源 | 原料 | 成品 | 说明 |
|---|---|---|---|
| 封面漫画 | `media/raw/2-4-cover-comic-prompt.md` | `media/processed/2-4-cover-comic.png` | 首页导入图，负责建立“从两张图看同一对象”的问题情境 |
| 信息图 | 无独立提示词文件 | `media/processed/2-4-info.png` | 总结本讲四条主线：Nyquist 入口、纯极点读图、频域指标、最小反识别 |

### 4.2 待制作

| 资源 | 正式文件名 | 当前说明 |
|---|---|---|
| 生成式课件 | `media/processed/2-4-slides.pdf` | 待按新版 handout / teacher-handout 统一口径生成 |
| 导入视频 | `media/processed/2-4-intro-video.mp4` | 待围绕“为什么同一条频率特性还要换一张图看”制作 |
| 课程视频 | `media/processed/2-4-course.mp4` | 待课堂录制或生成式课件旁白稳定后制作 |
| 音频播客 | `media/processed/2-4-audio.m4a` | 待课程视频脚本稳定后导出 |

---

## 5. 代码直出图与验证脚本映射

| 标识 | 原料文件 | 成品文件 | 工具 | 核心用途 |
|---|---|---|---|---|
| `fd-01` | `media/raw/2-4-fd-01-bode-dual-view-overview.tex` | `media/processed/2-4-fd-01-bode-dual-view-overview.png` | TikZ | 解释 Bode 图的双图结构，当前降为备用图 |
| `fd-02` | `media/raw/2-4-fd-02-log-frequency-db-intuition.tex` | `media/processed/2-4-fd-02-log-frequency-db-intuition.png` | TikZ | 对数坐标与 dB 直觉，当前不作为正文主图 |
| `fd-03` | `media/raw/2-4-fd-03-typical-elements-bode-comparison.m` | `media/processed/2-4-fd-03-typical-elements-bode-comparison.svg` | 既有代码直出图 | 标准对象轮廓对照，服务基础反识别 |
| `fd-04` | `media/raw/2-4-fd-04-first-order-exact-vs-asymptote.m` | `media/processed/2-4-fd-04-first-order-exact-vs-asymptote.svg` | 既有代码直出图 | 简单组合对象骨架补充 |
| `fd-05` | `media/raw/2-4-fd-05-first-order-nyquist-track.m` | `media/processed/2-4-fd-05-first-order-nyquist-track.svg` | 既有代码直出图 | 一阶惯性 Nyquist 起点、终点与方向 |
| `fd-06` | `media/raw/2-4-fd-06-pure-pole-nyquist-comparison.m` | `media/processed/2-4-fd-06-pure-pole-nyquist-comparison.svg` | 既有代码直出图 | 纯极点系统轨迹转角对照 |
| `fd-07` | `media/raw/2-4-fd-07-second-order-damping-bode.m` | `media/processed/2-4-fd-07-second-order-damping-bode.svg` | 既有代码直出图 | 二阶对象峰起与阻尼对照 |
| `fd-08` | `media/raw/2-4-fd-08-bode-nyquist-consistency-panel.m` | `media/processed/2-4-fd-08-bode-nyquist-consistency-panel.svg` | 既有代码直出图 | 同一对象的双图一致性 |
| `fd-09` | `media/raw/2-4-fd-09-bode-sketch-checklist.tex` | `media/processed/2-4-fd-09-bode-sketch-checklist.png` | TikZ | Bode 手工绘图入口检查单 |
| `fd-10` | `media/raw/2-4-fd-10-nyquist-sketch-checklist.tex` | `media/processed/2-4-fd-10-nyquist-sketch-checklist.png` | TikZ | Nyquist 手工绘图入口检查单 |
| `fd-11` | `media/raw/2-4-fd-11-margin-entry.py` + `media/raw/2-4-fd-11-margin-entry.m` | 无独立成图 | `python3 + control` + `MATLAB / Octave` | 例题三中的 $\omega_c$、$\omega_g$、$\gamma$、$K_g$、$\omega_b$ 数值核对与学生复现 |

---

## 6. 回写与后续制作要求

- `handout.md` 与 `interactive-page.md` 中的正文主图优先使用 `fd-05`、`fd-06`、`fd-08`、`fd-09`、`fd-10`
- `fd-03` 与 `fd-07` 主要服务“基础反识别”而非本讲主引入
- `fd-01` 与 `fd-02` 当前降为教师补充或课后复盘备用图，避免重新挤占 `2-3` 的合法空间
- 新增的频域指标数值例题，统一以 `2-4-fd-11-margin-entry.py` 为核对脚本
- 若后续重生成 `fd-03` 至 `fd-08`，优先迁移到 `python3 + control` 链路，避免长期维持旧口径分叉
