# 多模态资源设计 | 单元 3-1：纯极点视角下的稳定、模态与双域近似——为什么高阶系统仍能用低阶模型理解

> **资源总数**：12 项正式媒体规划，其中 8 项已完成、4 项待补齐。
> **当前完成**：`3-1-cover-comic.png`、`3-1-info.png` 与 `3-1-pp-01` 至 `3-1-pp-06` 六张主图。
> **待补齐**：`3-1-slides.pdf`、`3-1-intro-video.mp4`、`3-1-course.mp4`、`3-1-audio.m4a`。
> **本轮重点**：确认 3-1 现有 6 张 Octave 主图已经足以支撑讲义、教案与互动课程，不再无效新增“互动专用同义图”；把后续制作重点转到课程级交付与课堂开场素材。
> **验证约定**：本单元所有控制图统一以 `Octave + control` 为真值来源，优先复用已验证的 `.m + .svg/.pdf` 成对产物。

---

## 1. 本课资源采用单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
|---|---|---|---|---|---|
| `course-content/resource-library/pptx/8稳定_控制系统首要任务/README.md` | `pptx` | 讲义 §2.1、BOPPPS 导入、互动步骤 5 | 仅作灵感 | 可选融入 | 只吸收“稳定先是底线”这层教学顺序，不复用劳斯判据内容，也不把 3-1 拉回判稳细算课 |
| `course-content/resource-library/pptx/18幅相特性_换个角度看频域/README.md` | `pptx` | 讲义 §4、互动步骤 10-12 | 改写吸收 | 必融入 | 吸收“频域图形服务结构判断”的视角，但本课只用 Bode 图解释近似，不提前展开 Nyquist 判据 |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | 课堂导入口头背景 | 仅作灵感 | 可选融入 | 可用于教师口头说明“真实系统阶次常更高”，但其频域校正与裕度内容超出 3-1 边界，不直接进入正文 |
| `course-content/resource-library/civics-cases/integration-points.md` | `civics` | 总结页口头点拨 | 仅作灵感 | 可选融入 | 只吸收“工程近似需要边界意识，不可机械套结论”的系统观念，不单独插入案例阅读段 |
| `course-content/resource-library/pptx/19稳定判据_频域的启示/README.md` | `pptx` | 无 | 排除 | 排除 | 会把课堂推进到 Nyquist 判据与频域判稳，属于 `3-8` 的内容，不在本课使用 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 无 | 排除 | 排除 | 本课只显式引入带宽，不进入裕度设计与“宽备窄用”工程语言 |

---

## 2. 正式命名与目录约束

- 所有正式媒体固定使用 `3-1-...` 前缀。
- 本单元现有主图已经采用稳定命名：
  - `3-1-pp-01-stability-half-plane`
  - `3-1-pp-02-poles-and-modes`
  - `3-1-pp-03-dominant-pole-response-families`
  - `3-1-pp-04-modal-superposition-high-order`
  - `3-1-pp-05-bode-model-reduction`
  - `3-1-pp-06-convolution-step-from-impulse`
- 讲义封面图：`3-1-cover-comic.png`
- 讲义信息图：`3-1-info.png`
- 课程级待制媒体：
  - `3-1-slides.pdf`
  - `3-1-intro-video.mp4`
  - `3-1-course.mp4`
  - `3-1-audio.m4a`
- 原料目录固定为 `media/raw/`，成品目录固定为 `media/processed/`。

---

## 3. 资源总表

| 编号 | 文件名 | 类型 | 状态 | 引用于 |
|:---:|---|---|:---:|---|
| 1 | `3-1-cover-comic.png` | 讲义封面图 | 已完成 | `handout.md` 首页导入 |
| 2 | `3-1-info.png` | 讲义信息图 | 已完成 | `handout.md` 正文结束前；`interactive-page` 步骤 15 可复用 |
| 3 | `3-1-slides.pdf` | 生成式课件 | 待制作 | 课堂投屏 / 课件归档 |
| 4 | `3-1-intro-video.mp4` | 导入视频 | 待制作 | 课堂开场 / 互动课首页 |
| 5 | `3-1-course.mp4` | 课程内容视频 | 待制作 | 课程视频归档 |
| 6 | `3-1-audio.m4a` | 课程音频播客 | 待制作 | 音频归档 / 播客分发 |
| 7 | `3-1-pp-01-stability-half-plane.svg` | 代码直出图 | 已完成 | `handout` §2.1 / `interactive-page` 步骤 5 / `boppps` 导入段 |
| 8 | `3-1-pp-02-poles-and-modes.svg` | 代码直出图 | 已完成 | `handout` §2.3 / `interactive-page` 步骤 7 |
| 9 | `3-1-pp-03-dominant-pole-response-families.svg` | 代码直出图 | 已完成 | `handout` §3 / `interactive-page` 步骤 2、8、9 |
| 10 | `3-1-pp-04-modal-superposition-high-order.svg` | 代码直出图 | 已完成 | `handout` §5.3 / `interactive-page` 步骤 13 |
| 11 | `3-1-pp-05-bode-model-reduction.svg` | 代码直出图 | 已完成 | `handout` §4 / `interactive-page` 步骤 11、12 |
| 12 | `3-1-pp-06-convolution-step-from-impulse.svg` | 代码直出图 | 已完成 | `handout` §5.2 / `interactive-page` 步骤 13 |

---

## 4. 现有代码直出图与原料映射

| 标识 | 原料文件 | 成品文件 | 工具 | 核心用途 |
|---|---|---|---|---|
| `pp-01` | `media/raw/3-1-pp-01-stability-half-plane.m` | `media/processed/3-1-pp-01-stability-half-plane.svg` | Octave | 交代稳定区、临界边界与失稳区，建立“先能不能谈近似”的底线 |
| `pp-02` | `media/raw/3-1-pp-02-poles-and-modes.m` | `media/processed/3-1-pp-02-poles-and-modes.svg` | Octave | 把极点类型和响应形态做一一对应 |
| `pp-03` | `media/raw/3-1-pp-03-dominant-pole-response-families.m` | `media/processed/3-1-pp-03-dominant-pole-response-families.svg` | Octave | 三模型时域对照，服务主导极点近似的核心判断 |
| `pp-04` | `media/raw/3-1-pp-04-modal-superposition-high-order.m` | `media/processed/3-1-pp-04-modal-superposition-high-order.svg` | Octave | 明确展示留数符号、模态分量与总响应关系 |
| `pp-05` | `media/raw/3-1-pp-05-bode-model-reduction.m` | `media/processed/3-1-pp-05-bode-model-reduction.svg` | Octave | 统一呈现固有频率、附加极点转折频率与带宽关系 |
| `pp-06` | `media/raw/3-1-pp-06-convolution-step-from-impulse.m` | `media/processed/3-1-pp-06-convolution-step-from-impulse.svg` | Octave | 数值实验说明阶跃响应如何由延时脉冲响应叠加逼近 |

说明：

- `pp-03` 与 `pp-05` 是本课最关键的两张主图，分别对应时域证据链与频域证据链，应优先复用到教师投屏与互动课。
- `pp-06` 已按当前讲义要求调整：上图纵轴自适应，下图维持统一纵轴范围以突出整体比较。
- 当前没有必要为互动课再生成“同义版”图像，避免讲义、互动课、教案三套口径分叉。

---

## 5. 课程级媒体

### 5.1 已完成

| 资源 | 原料 | 成品 | 说明 |
|---|---|---|---|
| 封面漫画 | `media/raw/3-1-cover-comic-prompt.md` | `media/processed/3-1-cover-comic.png` | 首页导入图，负责建立“同一套极点语言如何支撑高阶系统理解”的问题情境 |
| 信息图 | `media/raw/3-1-info-source.svg` | `media/processed/3-1-info.png` | 总结本讲五条主线：稳定底线、模态语言、时域近似、频域近似、卷积闭环 |

### 5.2 待制作

| 资源 | 正式文件名 | 当前说明 |
|---|---|---|
| 生成式课件 | `media/processed/3-1-slides.pdf` | 待按新版 handout / teacher-handout 统一口径生成 |
| 导入视频 | `media/raw/3-1-intro-video-prompt.md` → `media/processed/3-1-intro-video.mp4` | 待围绕“同主导极点却不同响应”的冲突型机制制作 |
| 课程视频 | `media/processed/3-1-course.mp4` | 由 NotebookLM 生成课程级复习视频，不单独维护提示词文件 |
| 音频播客 | `media/processed/3-1-audio.m4a` | 由 NotebookLM 生成音频复习材料，不单独维护脚本文件 |

---

## 6. 讲义信息图与互动课复用策略

- `3-1-info.png` 可直接复用到互动课最后一步，不必为总结页再做一张新图。
- `3-1-pp-03` 与 `3-1-pp-05` 在互动课中应以“静态主图 + 页面交互问答”的方式使用，而不是重做成新的在线仿真。
- `3-1-pp-06` 与 `3-1-pp-04` 只在卷积/模态叠加页面集中出现，不拆散复用，避免学生丢失“输入激发模态”和“留数决定权重”的闭合关系。

---

## 7. 后续制作优先级

### P1：已完成，可直接复用

- `3-1-pp-01` 至 `3-1-pp-06`
- `3-1-cover-comic.png`
- `3-1-info.png`

### P2：应尽快补齐

- `3-1-intro-video.mp4`
- `3-1-slides.pdf`

### P3：待课程脚本稳定后再做

- `3-1-course.mp4`
- `3-1-audio.m4a`

---

## 8. 回写与实施要求

- `handout.md` 已完成主图回写，本轮不重复改动。
- `interactive-page.md` 直接复用现有 6 张主图与 `3-1-info.png`，不新增占位型假图。
- 若后续实际制作 `3-1-intro-video.mp4`，应在互动课入口页与课堂开场两处同时挂载。
- 教师投屏版课件生成时，优先保留三张关键图：`pp-03`、`pp-05`、`pp-06`；其余图作为解释支撑，不必平均分配时长。
