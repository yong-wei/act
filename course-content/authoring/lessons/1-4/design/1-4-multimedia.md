# 单元 1-4 多媒体资源规格

## 资源总表

| 编号 | 文件名 | 类型 | 用途 | 生成方式 | 状态 |
|---|---|---|---|---|:---:|
| 1-4-cover-comic | `1-4-cover-comic.png` | 位图（AI 生成） | 封面导入场景 | imagen 技能 | ✅ |
| 1-4-info | `1-4-info.png` | 位图（AI 生成） | 封底高信息密度总结 | imagen 技能 | ✅ |
| 1-4-fig-01 | `1-4-fig-01-step-responses.png` | 代码直出图 | 三组增益的闭环阶跃响应 | Octave control 包 | ✅ |
| 1-4-fig-02 | `1-4-fig-02-closed-loop-bode.png` | 代码直出图 | 闭环指令通道 Bode 与带宽 | Octave control 包 | ✅ |
| 1-4-fig-03 | `1-4-fig-03-open-loop-bode.png` | 代码直出图 | 环路对象的 Bode 趋势 | Octave control 包 | ✅ |
| 1-4-fig-03b | `1-4-fig-03b-loop-k8-bode.png` | 代码直出图 | step-06 环路面板的 L=8G0 Bode 后备图 | Octave control 包 | ✅ |
| 1-4-fig-04 | `1-4-fig-04-open-loop-nyquist.png` | 代码直出图 | 与图 1-4-3 同源的 Nyquist 轨迹 | Octave control 包 | ✅ |
| 1-4-fig-05 | `1-4-fig-05-four-views.png` | 代码直出图 | 闭环极点、阶跃与环路频率图并置 | Octave control 包 | ✅ |
| 1-4-fig-06 | `1-4-fig-06-three-domain-reading.png` | 代码直出图 | 航向闭环三域联读 | Octave control 包 | ✅ |

## 详细规格

### 1-4-cover-comic.png

- **用途**：讲义与互动课程步骤 1 的场景导入
- **内容**：船桥夜航场景，控制台同时呈现一次指令响应与周期扰动响应。画面表达“同一系统、两种观察尺度”，不承担定量读图。
- **文字**：仅保留单元编号、主题和副标题，避免在 AI 位图中加入公式或曲线刻度。
- **提示词**：见 `media/raw/1-4-cover-comic.prompt.md`
- **成品路径**：`media/processed/1-4-cover-comic.png`

### 1-4-info.png

- **用途**：讲义封底与互动课程总结页顶部
- **内容**：高信息密度信息图，分为“先标通道”“极点—时域联读”“Bode—Nyquist 同源”“闭环带宽与环路穿越频率辨析”四个区域。
- **准确性要求**：闭环极点、阶跃和闭环 Bode 使用 $T(s)=8/(s^2+4s+8)$；环路 Bode/Nyquist 使用 $L(s)=8/[s(s+4)]$。$\omega_b\approx2.83\ \mathrm{rad/s}$ 与 $\omega_c\approx1.82\ \mathrm{rad/s}$ 必须分别标注。
- **提示词**：见 `media/raw/1-4-info.prompt.md`
- **成品路径**：`media/processed/1-4-info.png`

### 1-4-fig-01-step-responses

- **对象**：$T_K(s)=K/(s^2+4s+K)$，$K=1,4,8$
- **内容**：三条单位阶跃响应同屏，基准值 1 以灰色虚线标出。$K=1$ 缓慢单调，$K=4$ 临界阻尼，$K=8$ 有约 $4.32\%$ 超调。
- **版式**：单面板，横轴 $0$–$15\ \mathrm{s}$，纵轴 $0$–$1.12$；中文坐标轴和手工图例。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-02-closed-loop-bode

- **对象**：闭环指令传递 $T(s)=8/(s^2+4s+8)$
- **内容**：幅频与相频上下排列；幅频图标出相对低频下降 3 dB 的水平线和 $\omega_b\approx2.825\ \mathrm{rad/s}$ 竖线。
- **边界**：图中不得把 $\omega_b$ 标成环路增益穿越频率，也不得用 `margin(T)` 的输出替代闭环带宽定义。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-03-open-loop-bode

- **对象**：$G_0(s)=1/[s(s+4)]$
- **内容**：幅频与相频上下排列，用于和图 1-4-4 做同源比较；不叠加闭环带宽标记。
- **读图锚点**：$\omega=2\ \mathrm{rad/s}$ 时幅值约 $-19.03$ dB，相位约 $-116.57^\circ$。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-03b-loop-k8-bode

- **对象**：环路传递 $L(s)=8G_0(s)=8/[s(s+4)]$
- **内容**：幅频与相频上下排列；幅频图明确标出 0 dB 水平线，并在上下两幅图标出 $\omega_c\approx1.820\ \mathrm{rad/s}$ 竖线。
- **用途边界**：仅供互动课程 step-06 的环路计算面板不可用时作为 fallback；不得替代图 1-4-3 的 $G_0(s)$ 同源 Bode/Nyquist 教学用途。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-04-open-loop-nyquist

- **对象**：与图 1-4-3 相同的 $G_0(s)$
- **内容**：正频率支与负频率共轭镜像支；实轴、虚轴分别绘制，正频率支始终位于第三象限并趋向原点。
- **边界**：用于解释复频率响应轨迹，不承担含虚轴极点系统的严格 Nyquist 判稳。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-05-four-views

- **对象分工**：左上闭环极点、右上闭环阶跃、左下环路幅频、右下环路 Nyquist。
- **内容**：$K=8$ 的四窗口并置；每个子图坐标轴明确标注，频域子图常显“环路”字样。
- **版式**：2×2，允许占满正文宽度。Nyquist 子图必须显示临界点 $(-1,0)$，但不据此给出完整判稳结论。
- **源文件**：`media/raw/generate_analysis_figures.m`

### 1-4-fig-06-three-domain-reading

- **对象**：闭环指令传递 $T(s)=8/(s^2+4s+8)$
- **内容**：闭环极点、阶跃响应和闭环幅频三栏并置；幅频图标出 $0.3$ 与 $3\ \mathrm{rad/s}$ 两个测试点。
- **数值**：$|T(j0.3)|\approx0.99994$、相位约 $-8.63^\circ$；$|T(j3)|\approx0.66436$、相位约 $-94.76^\circ$。
- **源文件**：`media/raw/generate_analysis_figures.m`

## 互动课程原生绘制策略

- 封面漫画和总结信息图使用 `content.figure`。
- 阶跃响应、闭环 Bode、环路 Bode/Nyquist、频点互译和四图联读采用共享 `compute.panel` 原生绘制。
- 原生面板必须由同一数值模型生成各域数据；控件置于图形下方，参数变化后图形同步更新。
- 现有正文曲线图只作为讲义媒体和原生面板不可用时的后备证据，不与原生图在同一页面重复常显。
- 互动页不得把成品曲线图片嵌入后再覆盖伪交互热点；频点光标、参数滑块和提交值必须绑定真实曲线数据。

## 媒体链接文档维护

`media/processed/1-4-media.md` 保留以下课程级资源节名：

- `1-4-intro-video.mp4`（已完成）
- `1-4-slides.pdf`（待制作）
- `1-4-course.mp4`（待制作）
- `1-4-audio.m4a`（待制作）
- `1-4-handout.md`（✅ 已导出）
- `1-4-teacher-handout.pdf`（待教师版确认后导出）

## 制作记录

- 2026-07-14：封面、封底信息图和六张正文分析图完成。
- 七张分析图由 Octave control 包计算并直接输出 PNG 与矢量 PDF；确定性指标记录在 `media/raw/generated-data/1-4-analysis-metrics.txt`。
- 2026-07-15：逐项复核闭环带宽、环路穿越频率、两个频点响应和例题数值；现有图片无缺失占位。
- 2026-07-17：新增 $L=8G_0$ 的 step-06 专用 fallback Bode 图，保留原图 1-4-3 的 $G_0$ 对象不变。
