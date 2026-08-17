# 多模态资源设计 | 单元 3-1：纯极点视角下的稳定、模态与双域近似

## 当前判断

`3-1` 现有的 6 张代码直出主图，已经足以支撑讲义、教案与互动课程的核心证据链。本课更需要做的，不是继续扩充意义相近的“同义图”，而是把现有图像用在准确的位置，并把后续制作重心转向课件、导入视频与课程级音频视频。

目前共有 12 项正式媒体规划，其中 9 项已经完成、3 项仍待补齐。现阶段已完成的是 `3-1-cover-comic.png`、`3-1-info.png`、`3-1-intro-video.mp4` 与 `3-1-pp-01` 至 `3-1-pp-06` 六张主图；尚待补齐的是 `3-1-slides.pdf`、`3-1-course.mp4`、`3-1-audio.m4a`。

本课所有控制图继续以 `Octave + control` 为真值来源，优先复用已经完成验证的 `.m + .svg/.pdf` 成对产物。

## 1. 本课资源采用单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
|---|---|---|---|---|---|
| `course-content/resource-library/pptx/8稳定_控制系统首要任务/README.md` | `pptx` | 讲义 §2.1、BOPPPS 导入、互动步骤 5 | 仅作灵感 | 可选融入 | 只吸收“稳定先是底线”这一教学顺序，不复用劳斯判据内容，也不把 `3-1` 拉回判稳细算课 |
| `course-content/resource-library/pptx/18幅相特性_换个角度看频域/README.md` | `pptx` | 讲义 §4、互动步骤 10-12 | 改写吸收 | 必融入 | 吸收“频域图形服务结构判断”的视角，但本课只用 `Bode` 图解释近似，不提前展开 Nyquist 判据 |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | 课堂导入口头背景 | 仅作灵感 | 可选融入 | 可用来说明真实系统阶次常更高，但其中的频域校正与裕度内容超出 `3-1` 边界，不直接进入正文 |
| `course-content/resource-library/civics-cases/integration-points.md` | `civics` | 总结页口头点拨 | 仅作灵感 | 可选融入 | 只吸收“工程近似需要边界意识，不可机械套结论”的系统观念，不单独插入案例阅读段 |
| `course-content/resource-library/pptx/19稳定判据_频域的启示/README.md` | `pptx` | 无 | 排除 | 排除 | 这组材料会把课堂带到 Nyquist 判据与频域判稳，属于 `3-8` 的内容 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 无 | 排除 | 排除 | 本课只显式引入带宽，也不延伸到裕度设计与“宽备窄用”的工程语言 |

## 2. 正式命名与目录约束

- 所有正式媒体统一使用 `3-1-...` 前缀。
- 已稳定命名的主图包括：
  - `3-1-pp-01-stability-half-plane`
  - `3-1-pp-02-poles-and-modes`
  - `3-1-pp-03-dominant-pole-response-families`
  - `3-1-pp-04-modal-superposition-high-order`
  - `3-1-pp-05-bode-model-reduction`
  - `3-1-pp-06-convolution-step-from-impulse`
- 讲义封面图为 `3-1-cover-comic.png`。
- 讲义信息图为 `3-1-info.png`。
- 课程级导入视频已发布：`3-1-intro-video.mp4`。
- 课程级待制媒体为：
  - `3-1-slides.pdf`
  - `3-1-course.mp4`
  - `3-1-audio.m4a`
- 原料目录固定为 `media/raw/`，成品目录固定为 `media/processed/`。

## 3. 资源总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 |
|:---:|---|---|:---:|---|
| 1 | `3-1-cover-comic.png` | 讲义封面图 | 已完成 | `handout.md` 首页导入 |
| 2 | `3-1-info.png` | 讲义信息图 | 已完成 | `handout.md` 正文结束前；`interactive-page` 步骤 15 可复用 |
| 3 | `3-1-slides.pdf` | 生成式课件 | 待制作 | 课堂投屏 / 课件归档 |
| 4 | `3-1-intro-video.mp4` | 导入视频 | 已完成 | 课堂开场 / 互动课首页 |
| 5 | `3-1-course.mp4` | 课程内容视频 | 待制作 | 课程视频归档 |
| 6 | `3-1-audio.m4a` | 课程音频播客 | 待制作 | 音频归档 / 播客分发 |
| 7 | `3-1-pp-01-stability-half-plane.svg` | 代码直出图 | 已完成 | `handout` §2.1 / `interactive-page` 步骤 5 / `boppps` 导入段 |
| 8 | `3-1-pp-02-poles-and-modes.svg` | 代码直出图 | 已完成 | `handout` §2.3 / `interactive-page` 步骤 7 |
| 9 | `3-1-pp-03-dominant-pole-response-families.svg` | 代码直出图 | 已完成 | `handout` §3 / `interactive-page` 步骤 2、8、9 |
| 10 | `3-1-pp-04-modal-superposition-high-order.svg` | 代码直出图 | 已完成 | `handout` §5.3 / `interactive-page` 步骤 13 |
| 11 | `3-1-pp-05-bode-model-reduction.svg` | 代码直出图 | 已完成 | `handout` §4 / `interactive-page` 步骤 11、12 |
| 12 | `3-1-pp-06-convolution-step-from-impulse.svg` | 代码直出图 | 已完成 | `handout` §5.2 / `interactive-page` 步骤 13 |

## 4. 现有代码直出图与原料映射

| 标识 | 原料文件 | 成品文件 | 工具 | 核心用途 |
|---|---|---|---|---|
| `pp-01` | `media/raw/3-1-pp-01-stability-half-plane.m` | `media/processed/3-1-pp-01-stability-half-plane.svg` | Octave | 交代稳定区、临界边界与失稳区，先把“能不能谈近似”说清楚 |
| `pp-02` | `media/raw/3-1-pp-02-poles-and-modes.m` | `media/processed/3-1-pp-02-poles-and-modes.svg` | Octave | 把极点类型与响应形态一一对应 |
| `pp-03` | `media/raw/3-1-pp-03-dominant-pole-response-families.m` | `media/processed/3-1-pp-03-dominant-pole-response-families.svg` | Octave | 呈现三模型的时域对照，是主导极点近似判断的核心证据 |
| `pp-04` | `media/raw/3-1-pp-04-modal-superposition-high-order.m` | `media/processed/3-1-pp-04-modal-superposition-high-order.svg` | Octave | 展示留数符号、模态分量与总响应之间的关系 |
| `pp-05` | `media/raw/3-1-pp-05-bode-model-reduction.m` | `media/processed/3-1-pp-05-bode-model-reduction.svg` | Octave | 统一呈现固有频率、附加极点转折频率与带宽的位置关系 |
| `pp-06` | `media/raw/3-1-pp-06-convolution-step-from-impulse.m` | `media/processed/3-1-pp-06-convolution-step-from-impulse.svg` | Octave | 用数值实验说明阶跃响应如何由延时脉冲响应叠加逼近 |

这里最关键的两张主图是 `pp-03` 与 `pp-05`，前者承担时域证据，后者承担频域证据。`pp-06` 则负责把卷积与模态叠加收拢成全课的最后解释。现有图像之间已经形成清晰分工，没有必要再为互动课额外制作“同义版”图像，以免讲义、互动课与教案的口径分叉。

## 5. 课程级媒体

### 5.1 已完成

| 资源 | 原料 | 成品 | 说明 |
|---|---|---|---|
| 封面漫画 | `media/raw/3-1-cover-comic-prompt.md` | `media/processed/3-1-cover-comic.png` | 首页导入图，用来建立“同一套极点语言为何能支撑高阶系统理解”的问题情境 |
| 信息图 | `media/raw/3-1-info-source.svg` | `media/processed/3-1-info.png` | 用于概括本讲五条主线：稳定底线、模态语言、时域近似、频域近似、卷积收束 |
| 导入视频 | `media/raw/3-1-intro-video-prompt.md` | `media/processed/3-1-intro-video.mp4` | 闲聊自控 Remotion 导入片，2026-08-17 发布 |

### 5.2 待制作

| 资源 | 正式文件名 | 当前说明 |
|---|---|---|
| 生成式课件 | `media/processed/3-1-slides.pdf` | 待按新版 `handout` 与 `teacher-handout` 的统一口径生成 |
| 课程视频 | `media/processed/3-1-course.mp4` | 由 NotebookLM 生成课程级复习视频，不单独维护提示词文件 |
| 音频播客 | `media/processed/3-1-audio.m4a` | 由 NotebookLM 生成音频复习材料，不单独维护脚本文件 |

## 6. 讲义信息图与互动课复用策略

- `3-1-info.png` 可以直接复用到互动课最后一步，不必为总结页另做一张新图。
- `3-1-pp-03` 与 `3-1-pp-05` 更适合在互动课中以“静态主图 + 页面问答”的形式出现，而不是重新做成在线调参仿真。
- `3-1-pp-06` 与 `3-1-pp-04` 最好集中放在卷积与模态叠加页面，避免拆散之后丢失“输入激发模态、留数决定权重”的完整关系。

## 7. 制作次序

### 第一层：已经完成，可直接复用

- `3-1-pp-01` 至 `3-1-pp-06`
- `3-1-cover-comic.png`
- `3-1-info.png`
- `3-1-intro-video.mp4`

### 第二层：建议尽快补齐

- `3-1-slides.pdf`

### 第三层：待课程脚本稳定后再制作

- `3-1-course.mp4`
- `3-1-audio.m4a`

## 8. 回写与实施说明

- `handout.md` 已经完成主图回写，这次不再重复改动。
- `interactive-page.md` 直接复用现有 6 张主图与 `3-1-info.png` 即可，不必新增占位型图片。
- `3-1-intro-video.mp4` 已发布，适合同时挂在互动课入口页与课堂开场两处。
- 教师投屏课件生成时，最值得优先保留的三张关键图依次是 `pp-03`、`pp-05`、`pp-06`；其余图像承担解释支撑作用，不需要平均分配时长。
