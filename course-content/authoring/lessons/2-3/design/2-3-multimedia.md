# 多模态资源设计 | 单元 2-3：频率响应基础与 Bode 图初步

> **资源总数**：19 项
> **生成方式分布**：已生成成品 12 项，新增规划媒体 7 项
> **当前状态**：频率响应主图与 `Bode` 首轮进入所需静态媒体已落盘；剩余待实现项集中在互动页面前端绘制资源。

## 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/16频率特性_换个角度看控制/README.md` | `pptx` | handout 导入 / 正文 / summary | 改写吸收 + 直接复用图片 | `必融入` | 只吸收频率响应定义、`Bode` 图概念与典型环节首轮表达，不照搬旧页序 |
| `course-content/resource-library/pptx/17近似叠加_绘制伯德图/README.md` | `pptx` | handout Bode 首轮骨架 / interactive step-11~13 | 改写吸收 + 直接复用图片 | `必融入` | 只服务对数坐标、手绘步骤与典型环节骨架，不提前扩成复杂技巧训练 |
| `course-content/resource-library/pptx/18幅相特性_换个角度看频域/README.md` | `pptx` | teacher note | 仅作灵感 | `可选融入` | 只供教师理解下节双图关系，不进入本课主链 |
| `course-content/resource-library/pptx/19稳定判据_频域的启示/README.md` | `pptx` | 本轮不接入 | 暂不采用 | `排除` | 本课不提前引入判据、裕度与稳定结论 |
| 思政案例 | `civics` | 本轮不接入 | 暂不采用 | `排除` | 当前正式映射未给 `2-3` 指定思政案例，本课不强行贴标签 |
| 船舶频域案例 | `ship-case` | 本轮不接入 | 暂不采用 | `排除` | 资源库当前将船舶频域案例映射到 `3-8/4-1`，不反向拉入 `2-3` 主线 |

---

## 资源总表

| 编号 | 文件名 | 用途 | 生成方式 | 引用于 | 状态 |
|:---:|:---|:---|:---|:---|:---|
| h-cover | `2-3-cover-comic.png` | 讲义开头封面图 | AI 位图 | `handout.md` 基本信息后 | 已生成 |
| h-01 | `2-3-fr-01-command-vs-disturbance.svg` | 讲义 | 代码直出图 | `handout.md` §1 | 已生成 |
| h-02 | `2-3-fr-02-square-wave-harmonics.svg` | 讲义 | 代码直出图 | `handout.md` §2 | 已生成 |
| h-03 | `2-3-fr-03-sine-in-sine-out.svg` | 讲义 | 代码直出图 | `handout.md` §2.3 | 已生成 |
| h-04 | `2-3-fr-04-linear-vs-log-frequency.svg` | 互动 / 教师讲解补图 | 代码直出图 | `interactive-page.md` step-11 / 后续教师讲义增补 | 已生成 |
| h-05 | `2-3-fr-05-bode-axes-and-typical-cards.svg` | 互动 / 教师讲解补图 | 代码直出图 | `interactive-page.md` step-12 / 后续教师讲义增补 | 已生成 |
| h-06 | `2-3-fr-06-bode-skeleton-workflow.svg` | 互动 / 教师讲解补图 | 代码直出图 | `interactive-page.md` step-13 / 后续教师讲义增补 | 已生成 |
| h-info | `2-3-info.png` | 讲义末尾信息图 | 位图 | `handout.md` 总结后、附录前 | 已生成 |
| ic-01 | `2-3-intro-video.mp4` | 课堂 / 互动课导入 | 中文视频提示词 | 后续互动课首页或课堂开场 | 已生成 |
| ic-02 | `ic-01-pretest-bars` | 互动前测统计 | 前端绘制 | `interactive-page.md` step-04 | 待实现 |
| ic-03 | `ic-02-harmonic-reconstruction` | 方波谐波重构工作区 | 前端绘制 | `interactive-page.md` step-06 | 待实现 |
| ic-04 | `ic-03-sine-response-lab` | 单频响应幅值/相位对照区 | 前端绘制 | `interactive-page.md` step-08 | 待实现 |
| ic-05 | `ic-04-log-frequency-intuition` | 线性坐标 vs 对数坐标对照区 | 前端绘制 | `interactive-page.md` step-11 | 待实现 |
| ic-06 | `ic-05-typical-bode-card-sorter` | 典型环节首轮判断卡片区 | 前端绘制 | `interactive-page.md` step-12 | 待实现 |
| ic-07 | `ic-06-bode-skeleton-builder` | Bode 首轮骨架工作区 | 前端绘制 | `interactive-page.md` step-13 | 待实现 |
| ic-08 | `ic-07-ai-compare-workspace` | AI 核验工作区 | 前端绘制 | `interactive-page.md` step-15 | 待实现 |
| sh-slides | `2-3-slides.pdf` | 生成式课件 | PDF | 课件导出配套 | 已生成 |
| sh-course | `2-3-course.mp4` | 课程内容视频 | 视频 | 课堂播放 / 课后复习 | 已生成 |
| sh-audio | `2-3-audio.m4a` | 课程音频播客 | 音频 | 课后复习 | 已生成 |

---

## 静态图片与脚本

- `media/raw/2-3-fr-01-command-vs-disturbance.py` -> `media/processed/2-3-fr-01-command-vs-disturbance.svg`
- `media/raw/2-3-fr-02-square-wave-harmonics.py` -> `media/processed/2-3-fr-02-square-wave-harmonics.svg`
- `media/raw/2-3-fr-03-sine-in-sine-out.py` -> `media/processed/2-3-fr-03-sine-in-sine-out.svg`
- 本轮补齐：
  - `media/raw/2-3-fr-04-linear-vs-log-frequency.py`
  - `media/raw/2-3-fr-05-bode-axes-and-typical-cards.py`
  - `media/raw/2-3-fr-06-bode-skeleton-workflow.py`
- 相关验证与复现脚本继续放在 `media/raw/`，但正式导出图和讲义引用都统一使用 `2-3-...` 前缀

---

## 新增媒体规格

### 资源 h-04 | 线性频率坐标 vs 对数频率坐标
- **建议成品**：`media/processed/2-3-fr-04-linear-vs-log-frequency.svg`
- **内容**：同一频率范围在两种坐标系下的视觉对照，突出“低频拥挤 / 高频拉长”与“每个十倍频程等宽”。
- **引用位置**：`interactive-page.md` step-11，后续教师讲义 `Bode` 图入口段补图。

### 资源 h-05 | Bode 坐标与典型环节首轮判断卡
- **建议成品**：`media/processed/2-3-fr-05-bode-axes-and-typical-cards.svg`
- **内容**：左侧是 `Bode` 坐标与 `20\log_{10}|G(j\omega)|` 提示，右侧是比例 / 积分 / 微分 / 惯性 / 振荡环节的首轮判断卡。
- **引用位置**：`interactive-page.md` step-12，后续教师讲义 `2.4.3` 补图。

### 资源 h-06 | Bode 首轮骨架四步流程图
- **建议成品**：`media/processed/2-3-fr-06-bode-skeleton-workflow.svg`
- **内容**：标准型 -> 转折频率 -> 低频段 -> 趋势叠加 四步流程。
- **引用位置**：`interactive-page.md` step-13，教师课堂讲义板书前提示。

---

## 提示词文件

### 讲义封面漫画

- 文件：`media/raw/2-3-cover-comic-prompt.md`
- 成品：`media/processed/2-3-cover-comic.png`
- 用途：讲义基本信息后、正文前的导入封面图

### 即梦导入视频

- 文件：`media/raw/2-3-intro-video-prompt.md`
- 成品：`media/processed/2-3-intro-video.mp4`
- 用途：课堂开场或互动课首页导入

---

## 交付说明

1. 讲义 `handout.md` 当前已统一引用现有 `2-3-...` 前缀媒体；本轮新增的 `h-04 ~ h-06` 暂作为互动页与教师讲解补图预留，不视为学生版讲义缺图。
2. 后续若重生成封面、频率响应图或导入视频，继续覆盖同名成品文件，不再改讲义引用路径。
3. 若继续扩展互动课，应优先落地 `ic-03 / ic-05 / ic-06 / ic-07` 四个工作区，它们最能体现本课“对象建立 + 图形首轮进入”的教学收益。
