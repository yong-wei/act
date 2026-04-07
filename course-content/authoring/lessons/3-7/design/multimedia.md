# 单元 3-7 多模态资源设计与采用清单

> **当前阶段目标**：围绕“误差分析总入口课”补齐本课正式媒体，统一支撑双通道列式、型别判断、纯增益局限、`PI`/滞后时域设计，以及频域下 `PI` 与 `PD` 的对比。
> **命名前缀**：全部统一使用 `3-7-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/9稳态误差_准确性的度量/README.md` | `pptx` | 双通道传函、终值定理、型别表 | 改写吸收 | 必融入 | 只吸收误差分析组织逻辑，不复用旧图 |
| `course-content/resource-library/pptx/3方框图_控制系统结构/README.md` | `pptx` | 图 3-7-1 统一结构图 | 改写吸收 | 必融入 | 只吸收结构表达方式，由本课重新绘制 TikZ 框图 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | `PI`/滞后对照、零极点相对位置说明 | 改写吸收 | 必融入 | 只吸收低频补偿机理，不提前进入模块 4 的联合校正 |
| `course-content/resource-library/pptx/21三频段_各司其职/README.md` | `pptx` | 频域设计收束语 | 改写吸收 | 必融入 | 只服务“低频决定精度”的桥接口径 |

---

## 2. 讲义正文正式媒体总表

| 编号 | 文件名 | 类型 | 用途 |
| :---: | --- | --- | --- |
| 1 | `3-7-cover-comic.png` | 代码直出封面 | 讲义首页导入 |
| 2 | `3-7-error-dual-channel.png` | TikZ 框图 | 给定/扰动双通道统一结构 |
| 3 | `3-7-example2-structure.png` | TikZ 框图 | 例题 2 中间扰动结构图 |
| 4 | `3-7-low-frequency-compensators.png` | Octave 三子图 | PI、滞后、超前三子图 |
| 5 | `3-7-pi-time-domain-design.png` | Octave 组合图 | 纯增益与 PI 的根轨迹/时域对比 |
| 6 | `3-7-lag-time-domain-design.png` | Octave 组合图 | 滞后校正根轨迹与时域验证 |
| 7 | `3-7-pi-frequency-design.png` | Octave Bode 图 | PI 频域设计步骤化结果 |
| 8 | `3-7-pi-pd-comparison.png` | Octave 对比图 | PI 与 PD 性能对比 |
| 9 | `3-7-info.png` | 代码直出信息图 | 讲义末尾总结 |

## 2.1 标准必需交付件

以下文件不一定都在讲义正文直接引用，但属于本课 runtime-first 审查链的标准交付件，必须与上表一起核对完整性：

| 文件名 | 类型 | 当前角色 | 来源链路 |
| --- | --- | --- | --- |
| `design/handout.pdf` | 讲义 PDF | runtime 下载版讲义源 | `design/handout.md` 导出 |
| `media/processed/3-7-intro-video.mp4` | 导入视频 | 课前导入与预习资源 | 外部生成后纳入媒体索引 |
| `media/processed/3-7-audio.m4a` | 音频 | 配套音频资源 | 外部生成后纳入媒体索引 |
| `media/processed/3-7-slides.pdf` | 课件 PDF | 课堂/预习配套课件 | 外部导出后纳入媒体索引 |
| `media/processed/3-7-course.mp4` | 课程视频 | 课程主视频资源 | 外部生成后纳入媒体索引 |
| `media/processed/3-7-media.md` | 媒体索引 | runtime 媒体入口清单 | 由审查/导出链维护 |

---

## 3. 原始脚本与生成入口

### 3.1 结构图

- **TikZ 源文件**：`media/raw/3-7-error-dual-channel.tex`
- **导出脚本**：`media/raw/3-7-render-block-diagram.py`
- **规范要求**：
  - 修正虚线框范围、输出映出点、反馈回路紧凑度和 `H(s)` 垂直位置；
  - 白底、非透明成品；
  - 比较点、控制器、扰动注入点、反馈环节同时清楚可见。
  - 给定通道虚线框完整包住 `G_c(s)` 与 `G_p(s)`，扰动通道虚线框只包住 `G_p(s)`。

### 3.2 例题结构图

- **TikZ 源文件**：`media/raw/3-7-example2-structure.tex`
- **导出脚本**：`media/raw/3-7-render-block-diagram.py`
- **规范要求**：
  - 前向通道显式拆成两个串联环节；
  - 扰动加在两者之间；
  - 单位反馈回路和比较点清晰可见；
  - 图形要能直接支撑“执行器之后、对象之前的中间扰动”口径。

### 3.3 数值曲线与设计验证

- **权威绘图入口**：`media/raw/3-7-generate-plots.m`
- **权威数值核验入口**：`media/raw/3-7-steady-error-validation.m`
- **辅助数据脚本**：`media/raw/generate_design_data.m`
- **辅助渲染脚本**：`media/raw/render_figures.py`
- **兼容性重绘脚本**：`media/raw/3-7-generate-plots.py`
- **输出内容**：
  - 纯增益与 PI 的根轨迹/阶跃/斜坡对比；
  - PI、滞后、超前在转折频率上的三子图比较；
  - 滞后校正根轨迹与时域验证；
  - PI 频域设计的 Bode 图与关键标注；
  - PI 与 PD 性能对比图。
- **约束**：
  - 所有时域、根轨迹、频域数值曲线均由 MATLAB/Octave 脚本生成；
  - 本课正式数值图的审查口径以 `.m` 脚本为准；若使用 `.py` 辅助渲染，输入必须来自 `.m` 生成的数据，不得另行改写结论；
  - `generate_design_data.m` + `render_figures.py` 与 `3-7-generate-plots.py` 仅作为辅助重绘链路，不单独作为正式结果的权威依据；
  - 图中标注的参数、性能指标和正文结论必须一一对应。

### 3.4 封面与信息图

- **脚本**：`media/raw/3-7-render-summary-cards.py`
- **输出内容**：
  - `3-7-cover-comic.png`
  - `3-7-info.png`

---

## 4. 媒体设计约束

1. 正文不再直接引用资源库图片；正式媒体全部落到本课 `media/processed/`。
2. 结构图必须体现给定、扰动、输出与反馈四个关键位置，且用 TikZ 绘制。
3. 时域设计图片必须同时体现根轨迹可行域与时域验证，而不是只放单张阶跃图。
4. 频域设计图片必须体现纯增益法的限制、PI 补偿步骤和最终核验结果。
5. `PI` 与 `PD` 的比较图必须同时给出性能指标和响应形态差异，不能只留结论文字。
6. 所有正式图片都使用白底，不使用透明背景。

---

## 5. 可选资源

以下文稿仍保留在 `media/raw/`，但本轮讲义定稿不依赖它们：

- `3-7-cover-comic-prompt.md`
- `3-7-intro-video-prompts.md`

## 6. 额外产物与归属说明

以下文件保留在 `media/processed/`，但不计入“讲义正文直接引用的正式媒体总表”；保留目的是复查、打印检查或下游实现复用：

| 文件名 | 归属 | 保留原因 |
| --- | --- | --- |
| `3-7-error-dual-channel.pdf` | TikZ 框图中间产物 | 保留矢量版，便于二次排版与打印检查 |
| `3-7-example2-structure.pdf` | TikZ 框图中间产物 | 保留矢量版，便于二次排版与打印检查 |
| `3-7-lag-frequency-bode.png` | 辅助分析图 | 用于校对滞后低频补偿的频域效果，不作为正文主图 |
| `3-7-lag-time-domain-step.png` | 辅助分析图 | 用于补充查看滞后时域响应细节 |
| `3-7-pi-frequency-bode.png` | 辅助分析图 | 用于补充查看 PI 频域核验细节 |
| `3-7-pi-time-domain-step.png` | 辅助分析图 | 用于补充查看 PI 时域响应细节 |

这些额外产物可以保留，但不应替代第 2 节列出的正式媒体，也不应让下游无法判断哪一份是本课的正式交付图。
