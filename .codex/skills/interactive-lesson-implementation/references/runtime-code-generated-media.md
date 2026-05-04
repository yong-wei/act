# 代码直出 / SVG 绘制资源规则

## 适用范围

本规则适用于：

- 作者态用 `python3` / `Octave` 生成的控制图、响应图、频域图、根轨迹图
- 运行时由 Rust/WASM 控制分析引擎驱动、前端实时重绘的曲线图工作区
- 前端可直接绘制的 SVG 结构图、知识结构图、流程图、原生表格
- 线框型方框图、信号流图、电路图、弹簧阻尼系统示意图

不适用于：

- 真人视频录屏
- 实拍照片
- 复杂插画
- 需要手工设计软件排版的海报类图片

## 技术路线

### 控制系统图与仿真

作者态静态图、离线夹具与核验数据统一优先使用 `python3 + control` 或 `Octave`：

- 阶跃响应、脉冲响应、斜坡响应
- 频率响应、伯德图、奈奎斯特图
- 根轨迹、极点轨迹
- 参数变化对动态性能的影响图

凡涉及课程结论、图上数值、指标标注的确定性结果，都应尽量由脚本直接算出，不靠手绘或拍脑袋标注。

页面或讲义引用这些图片时，图片下方文案不得直接使用页面标题、模块标题、图片标题或文件名。无读图价值时不显示 caption；需要显示时，必须写成图片具体内容、可观察证据、读图顺序或基于图片的分析判断。

互动课运行时的参数联动曲线不再默认走 `python3` 实时计算，而是统一复用共享 Rust/WASM 控制分析引擎、共享请求接口与固定面板工作区。当前基线以 `4-1` 的 `useControlEngine -> control-analysis.worker.ts -> compute_analysis -> ControlFigureWorkspace` 为准。

运行时面板对学生呈现时只写学科内容标题和必要控件标签。标题不得暴露 Rust、WASM、三标签、对照面板、原生统一面板等工程或界面形式口径；除标题外，不再添加解释引擎、板式或实现方式的说明文案。Rust 驱动面板标题字号统一采用课堂模块标题规格 `text-base font-semibold leading-7 tracking-normal`，与“个人课堂表现”“班级整体表现统计”等模块保持一致。

### 线框图

以下内容统一优先使用 `tikz-control-draw`：

- 方框图
- 信号流图
- 电路图
- 机械结构图

不要用 ASCII 图替代，也不要截图论文/PPT 当正式资源。

## 目录约定

### 原始脚本与源文件

放在：

`course-content/authoring/lessons/.../<lesson>/media/raw/`

这里可以包含：

- `*.py`
- `*.tex`
- 共享模块
- 参数配置文件

### 处理后产物

先生成到：

`course-content/authoring/lessons/.../<lesson>/media/processed/`

这里是浏览器抽查、内容审查和导出前的唯一落点。

### runtime 产物

审核通过后，再导出到：

`course-content/runtime/lessons/.../<lesson>/media/`

不要跳过 `processed/`，也不要默认直接把脚本输出打到 runtime。

## 制作流程

1. 从 `multimedia.md`、`interactive-page.md` 与 runtime review 中识别缺失媒体。
2. 判断该媒体属于：
   - 运行时 Rust/WASM 曲线工作区
   - `python3 + control` / `Octave`
   - `tikz-control-draw`
   - 前端 SVG / Canvas / HTML 原生绘制
3. 在 `media/raw/` 补脚本或源文件。
4. 统一生成到 `media/processed/`。
5. 抽样浏览器核对图像内容、中文、布局和尺寸。
6. 通过 `bash course-content/scripts/export-runtime.sh <lesson>` 导出到 runtime。
7. 页面只消费 runtime 路径。

## 脚本要求

- 所有脚本尽量支持 `--output <path>`
- 统一使用 `python3`
- 共享配置抽公共模块，不在多个脚本中重复散写
- 涉及中文文本时，显式配置 CJK 字体
- 导出 SVG 时，优先避免部署后再依赖系统字体

## 字体与符号规则

### 中文字体

代码直出图只要包含中文，必须显式配置系统中文字体，不能依赖默认字体链。

建议：

- 提供统一字体辅助模块
- 设置：
  - `rcParams['font.family']`
  - `rcParams['axes.unicode_minus'] = False`
  - `rcParams['svg.fonttype'] = 'path'`

### 特殊符号

若系统字体不稳定覆盖某些符号：

- 优先改成兼容写法
- 例如把 `p₁ / p₂` 改为 `p1 / p2`
- 除非教学含义强依赖该符号，否则不保留高风险特殊字符

## 前端 SVG 绘制规则

前端绘制图必须：

- 先拆成语义元素：块、箭头、回路线、标签、区域
- 保证关键组件相对关系稳定
- 布局改动后至少截图核对一次

方向箭头默认从 `src/features/interactive/shared/interactive-svg-markers.tsx` 复用共享定义：

- 每个 SVG 内放置 `InteractiveSvgMarkerDefs`，不要在单课组件中手写私有 `<marker>`
- 常规方向箭头使用 `arrow-slim-concave`，通过 `InteractiveSvgMarkerRegistry.markerUrl('arrow-slim-concave', prefix)` 引用
- `InteractiveSvgMarkerDefs` 必须传入当前线条的实际 `lineStrokeWidth`，让 marker 大小随线宽调整，不手动固定 `markerWidth` / `markerHeight`
- 只有设计契约明确要求宽开口箭头或其他特殊箭头语义时，才使用其他共享 marker kind
- 起点、交点、极点等点标优先使用 `InteractiveSvgPointMarker`

重点检查：

- 回路线是否对齐
- 标签是否压线或漂移
- `viewBox` 是否覆盖完整内容
- 移动端缩放后是否可读
- 箭头是否来自共享 marker，且随线宽同步缩放

## 与当前互动课基线对齐

`1-1`、`1-2`、`1-3` 已固化出以下经验，后续课程默认沿用：

- 代码直出媒体先进入 `media/processed/` 再导出 runtime
- 页面统一通过 runtime 路径读取媒体
- 浏览器要检查真实中文显示，而不只是“文件存在”
- 线框图和控制图应优先走真实绘制/仿真流程，不要回退到 ASCII 或截图占位
- `4-1` 已进一步固化出“统一 Rust/WASM 曲线引擎 + 固定面板组合 + 固定坐标范围 + 指标覆盖层”的运行时基线，后续课程默认沿用

## 最小验证清单

- [ ] 已判断资源属于运行时 Rust/WASM 曲线工作区、`python3 + control` / `Octave`、`tikz-control-draw` 或前端原生绘制
- [ ] 原始脚本/源文件已落在 `media/raw/`
- [ ] 处理后产物已落在 `media/processed/`
- [ ] 前端 SVG 箭头已使用共享 `InteractiveSvgMarkerDefs`，常规方向箭头为 `arrow-slim-concave`，并传入实际 `lineStrokeWidth`
- [ ] 已完成浏览器抽查
- [ ] 中文文本可见
- [ ] 无明显错位、越界、遮挡
- [ ] 已通过 `export-runtime.sh` 导出到 runtime
- [ ] 页面实际读取 runtime，而不是直接读取作者态
- [ ] 最终交付没有 ASCII 图
