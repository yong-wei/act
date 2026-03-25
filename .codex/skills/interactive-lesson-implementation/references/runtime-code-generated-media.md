# 代码直出 / SVG 绘制资源规则

## 适用范围

本规则适用于：

- `python3` 脚本可生成的控制图、响应图、频域图、根轨迹图
- 前端可直接绘制的 SVG 结构图、知识结构图、流程图
- 线框型方框图、信号流图、电路图、弹簧阻尼系统示意图

不适用于：

- 真人视频录屏
- 实拍照片
- 复杂插画
- 需要手工设计软件排版的海报类图片

## 技术路线

### 控制系统图与仿真

以下内容统一优先使用 `python3 + control`：

- 阶跃响应、脉冲响应、斜坡响应
- 频率响应、伯德图、奈奎斯特图
- 根轨迹、极点轨迹
- 参数变化对动态性能的影响图

凡涉及课程结论、图上数值、指标标注的确定性结果，都应尽量由脚本直接算出，不靠手绘或拍脑袋标注。

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
   - `python3 + control`
   - `tikz-control-draw`
   - 前端 SVG 绘制
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

重点检查：

- 回路线是否对齐
- 标签是否压线或漂移
- `viewBox` 是否覆盖完整内容
- 移动端缩放后是否可读

## 与当前互动课基线对齐

`1-1`、`1-2`、`1-3` 已固化出以下经验，后续课程默认沿用：

- 代码直出媒体先进入 `media/processed/` 再导出 runtime
- 页面统一通过 runtime 路径读取媒体
- 浏览器要检查真实中文显示，而不只是“文件存在”
- 线框图和控制图应优先走真实绘制/仿真流程，不要回退到 ASCII 或截图占位

## 最小验证清单

- [ ] 已判断资源属于 `python3 + control`、`tikz-control-draw` 或前端 SVG
- [ ] 原始脚本/源文件已落在 `media/raw/`
- [ ] 处理后产物已落在 `media/processed/`
- [ ] 已完成浏览器抽查
- [ ] 中文文本可见
- [ ] 无明显错位、越界、遮挡
- [ ] 已通过 `export-runtime.sh` 导出到 runtime
- [ ] 页面实际读取 runtime，而不是直接读取作者态
- [ ] 最终交付没有 ASCII 图
