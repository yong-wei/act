# 单元 1-3 多媒体资源规格

## 资源总表

| 编号 | 文件名 | 类型 | 用途 | 生成方式 | 状态 |
|------|------|------|------|------|:---:|
| 1-3-cover-comic | `1-3-cover-comic.png` | 位图（AI生成） | 封面导入图 | imagen技能 | ✅ |
| 1-3-info | `1-3-info.png` | 位图（AI生成） | 封底信息图总结 | imagen技能 | ✅ |
| 1-3-fig-01 | `1-3-fig-01-open-loop-scaling.png` | 代码直出图 | 图1-3-1 开环增益比例缩放 | Octave control 包计算并直接成图 | ✅ |
| 1-3-fig-02 | `1-3-fig-02-open-closed-loop.png` | 线框图 | 图1-3-2 开环闭环方框图对照 | TikZ | ✅ |
| 1-3-fig-03 | `1-3-fig-03-closed-loop-responses.png` | 代码直出图 | 图1-3-3 三组增益闭环阶跃响应 | Octave control 包计算并直接成图 | ✅ |
| 1-3-fig-04 | `1-3-fig-04-root-locus.png` | 代码直出图 | 图1-3-4 根轨迹雏形 | Octave control 包计算并直接成图 | ✅ |

## 详细规格

### 1-3-cover-comic.png
- **用途**：单元封面，讲义首页展示
- **类型**：AI位图
- **内容描述**：自动舵增益旋钮的特写场景——一只手正在拧动船桥控制台上的增益旋钮，背景中同时出现三张图的虚影：复平面上两个极点沿实轴相向移动、时域响应曲线从单调过渡到振荡、根轨迹分支从实轴离开。旋钮是视觉焦点，三张图作为"旋钮引发的后果"环绕在周围。
- **风格约束**：工程感、暖灰色调、画面留白充足、文字极少（仅旋钮旁标注"K↗"）
- **生成提示词**：见 `media/raw/1-3-cover-comic.prompt.md`
- **成品路径**：`media/processed/1-3-cover-comic.png`

### 1-3-info.png
- **用途**：单元封底，全讲内容的信息图总结
- **类型**：AI位图
- **内容描述**：以信息图形式组织本讲核心内容链路——上方为开环vs闭环增益角色对比（两列并排），中部为K值三段论（0<K<4实极点→K=4重极点→K>4复极点）配合极点迁移箭头，下方为根轨迹雏形示意图与三个可带走判断的文字。整体分区清晰，箭头和编号引导阅读顺序。
- **生成提示词**：见 `media/raw/1-3-info.prompt.md`
- **成品路径**：`media/processed/1-3-info.png`

### 1-3-fig-01-open-loop-scaling
- **用途**：图1-3-1，展示开环系统在K=1,2,4下的阶跃响应
- **类型**：代码直出图（时域曲线）
- **内容**：三条斜坡状增长曲线同屏，K=4的曲线恰好为K=1的四倍，K=2居中。三条曲线形态完全一致——开环增益只缩放输出。
- **技术参数**：横轴0-10s，纵轴自动缩放。K=1用蓝色实线，K=2用绿色虚线，K=4用红色点划线。图例标注K值。
- **Octave生成**：`media/raw/generate_analysis_figures.m` 中 `open_loop_scaling()` 函数
- **输出格式**：同名 PNG 用于网页和 Markdown，同名 PDF 作为矢量版用于讲义导出
- **成品路径**：`media/processed/1-3-fig-01-open-loop-scaling.png` / `.pdf`

### 1-3-fig-02-open-closed-loop
- **用途**：图1-3-2，开环与闭环方框图对照
- **类型**：线框图（TikZ）
- **内容**：上下两行对照——上行为开环结构（R(s)→K→G₀(s)→Y(s)，无反馈通路），下行为单位负反馈闭环结构（R(s)→⊗→K→G₀(s)→Y(s)，反馈通路从Y(s)回到⊗）。上行标注"K在分子上——只缩放输出"；下行标注"K进入了特征方程的分母"。
- **几何约束**：按tikz-control-draw方框图几何规则——上下两行的K块和G₀(s)块垂直对齐以便对照
- **TikZ源文件**：`media/raw/tikz/1-3-fig-02-open-closed-loop.tex`
- **成品路径**：`media/processed/1-3-fig-02-open-closed-loop.png`（白底展平PNG用于Markdown）、`.pdf`（矢量版用于PDF导出）

### 1-3-fig-03-closed-loop-responses
- **用途**：图1-3-3，三组增益下的闭环阶跃响应同屏对照
- **类型**：代码直出图（时域曲线族）
- **内容**：K=1（蓝色）、K=4（绿色）、K=8（红色）三条闭环阶跃响应曲线。K=1缓慢单调上升，K=4快速单调逼近，K=8先冲过头约4%再边摆边收。标注±5%误差带（灰色虚线）和各曲线的调节时间。
- **技术参数**：横轴0-15s，纵轴0-1.2。图例标注各K值的调节时间。
- **Octave生成**：`media/raw/generate_analysis_figures.m` 中 `closed_loop_responses()` 函数
- **输出格式**：同名 PNG 与矢量 PDF
- **成品路径**：`media/processed/1-3-fig-03-closed-loop-responses.png` / `.pdf`

### 1-3-fig-04-root-locus
- **用途**：图1-3-4，根轨迹雏形
- **类型**：代码直出图（复平面曲线）
- **内容**：复平面上两支根轨迹从s=0和s=-4出发，沿实轴相向移动到s=-2会合，然后垂直上下对称展开。箭头标注K增大方向。背景只轻量区分左半平面稳定区和右半平面不稳定区。标注三个K值对应的极点位置（K=1实心点、K=4交叉点、K=8空心点）。虚轴单独以虚线标出（实部=0），不得与实部为-2的根轨迹分支混淆。
- **技术参数**：横轴（实部）-5到1，纵轴（虚部）-4到4，等比例坐标轴。使用 `rlocus(G0)` 自动采样并由 Octave 直接绘制。
- **Octave生成**：`media/raw/generate_analysis_figures.m` 中 `root_locus_sketch()` 函数
- **输出格式**：同名 PNG 与矢量 PDF
- **成品路径**：`media/processed/1-3-fig-04-root-locus.png` / `.pdf`

## 媒体链接文档维护

`media/processed/1-3-media.md` 需保留以下课程级资源节名：
- `1-3-intro-video.mp4`（待制作）
- `1-3-slides.pdf`（待制作）
- `1-3-course.mp4`（待制作）
- `1-3-audio.m4a`（待制作）
- `1-3-handout.pdf`（✅ 已导出）

## 制作记录

- 2026-07-13：四张正文媒体（fig-01~fig-04）全部完成。封面图和封底信息图由 imagen 技能生成。
- 图1-3-1/1-3-3/1-3-4：Octave control 包完成计算并直接输出 PNG 与矢量 PDF；指标写入 `media/raw/generated-data/1-3-response-metrics.txt`
- 图1-3-2：TikZ 源码 → XeLaTeX 编译 → PDF；白底 PNG 用于 Markdown
- 数值验证：Octave `generate_analysis_figures.m` 脚本输出 `1-3-response-metrics.txt`，含K=1,4,8时超调量、调节时间等精确数值
