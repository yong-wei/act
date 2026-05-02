# 单元 4-7 多模态资源设计与采用清单

> **当前阶段目标**：围绕“高保真任务观察、分段辨识、传统设计、优化设计、扰动噪声边界、传统结构局限”组织正式媒体。所有核心图像应支撑讲义、教师版讲义、知识卡片和 BOPPPS，不再沿用旧的“客船与驱逐舰双场景比较”口径。
> **命名前缀**：全部统一使用 `4-7-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/ship-control-cases/sections/6.1-船舶航向控制频域校正.md` | `ship-case` | 传统设计四联图、$PI+\text{超前}$ 结构解释 | 改写吸收 | 必融入 | 只保留传统频域校正方法，不照搬旧案例对象和旧图序 |
| `course-content/resource-library/ship-control-cases/sections/6.2-航向控制系统鲁棒性与性能指标权衡.md` | `ship-case` | 扰动分级、裕度、抗扰设计讨论 | 改写吸收 | 必融入 | 只服务扰动边界，不把本课扩写成鲁棒控制专题 |
| `course-content/resource-library/pptx/22串联校正/README.md` | `pptx` | 传统设计参数计算与频域指标标注 | 仅作灵感 | 可选融入 | 只吸收 Bode 图和串联校正表达习惯 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | 优化设计结构家族和解码说明 | 仅作灵感 | 可选融入 | 不展开旧式滞后超前章节 |

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 用途 |
| :---: | --- | --- | --- | --- |
| 1 | `4-7-cover-comic.png` | AI 位图 | 已就位 | 学生讲义封面 |
| 2 | `4-7-info.png` | AI 信息图 | 已就位 | 学生讲义封底 |
| 3 | `4-7-segmented-identification-block.png` | TikZ 方框图 | 已有 | 分段辨识结构 |
| 4 | `4-7-rudder-actuator-step-identification.png` | 代码直出图 | 已有 | 舵机惯性辨识 |
| 5 | `4-7-hull-yaw-step-identification.png` | 代码直出图 | 已有 | 船体惯性辨识 |
| 6 | `4-7-disturbance-step-identification.png` | 代码直出图 | 已有 | 扰动等效惯性尝试 |
| 7 | `4-7-traditional-diagnosis-four-panel.png` | 代码直出四联图 | 已有 | 传统设计诊断 |
| 8 | `4-7-traditional-design-four-panel.png` | 代码直出四联图 | 已有 | 传统设计校正结果 |
| 9 | `4-7-nominal-traditional-zigzag45.png` | 代码直出图 | 已有 | 传统设计方波跨模型验证 |
| 10 | `4-7-nominal-traditional-turning_ramp.png` | 代码直出图 | 已有 | 传统设计回转跨模型验证 |
| 11 | `4-7-optimization-convergence-identified.png` | 代码直出图 | 已有 | 辨识模型优化收敛 |
| 12 | `4-7-optimization-convergence-hifi.png` | 代码直出图 | 已有 | 高保真模型优化收敛 |
| 13 | `4-7-nominal-optimized-zigzag45.png` | 代码直出图 | 已有 | 优化控制器方波对比 |
| 14 | `4-7-nominal-optimized-turning_ramp.png` | 代码直出图 | 已有 | 优化控制器回转对比 |
| 15 | `4-7-disturbance-controller-zigzag45.png` | 代码直出图 | 已有 | 有扰动方波控制器对比 |
| 16 | `4-7-disturbance-controller-turning_ramp.png` | 代码直出图 | 已有 | 有扰动回转控制器对比 |
| 17 | `4-7-noise-controller-zigzag45.png` | 代码直出图 | 已有 | 航向传感器噪声方波对比 |
| 18 | `4-7-noise-controller-turning_ramp.png` | 代码直出图 | 已有 | 航向传感器噪声回转对比 |
| 19 | `4-7-real-scenario-interpretation.png` | 代码直出图 | 已补齐 | 传统结构局限说明 |
| 20 | `4-7-intro-video-prompts.md` | 导入视频提示词 | 已修订 | 15 秒课程导入视频 |
| 21 | `4-7-media.md` | 媒体链接文档 | 已有并修订 | 课程级媒体登记入口 |

## 3. 原始脚本与生成入口

### 3.1 高保真数据与图像

- **Python 脚本**：`reports/generate_destroyer_hifi_report.py`
- **用途**：
  - 生成舵机、船体、扰动分段辨识图；
  - 生成传统、优化、扰动、噪声对比图；
  - 输出 `reports/data/4-7-destroyer-hifi-experiment.json` 作为高保真证据数据。

### 3.2 传统设计四联图数据

- **Octave 脚本**：`reports/generate_traditional_design_four_panel_data.m`
- **用途**：
  - 用 Octave 生成阶跃、Bode、Nyquist、根轨迹所需数据；
  - 支撑 MATLAB 式完整 Bode 图和根轨迹布局；
  - 保证传统设计图不是手工绘制的示意图。

### 3.3 分段辨识结构图

- **TikZ 源文件**：`media/raw/4-7-segmented-identification-block.tex`
- **用途**：
  - 绘制中文闭环方框图；
  - 明确“期望航向、比较点、控制器、舵机、船体艏摇、积分、反馈通道、扰动入口”的连接顺序。

### 3.4 旧设计闭环补图

- **Python 脚本**：`media/raw/render_design_closure_figures.py`
- **用途**：
  - 仅用于补齐仍被讲义引用的 `4-7-real-scenario-interpretation.png`；
  - 不作为本轮高保真主证据来源。

## 4. 媒体设计约束

1. 四联图的 Bode 子图必须是完整 MATLAB 式 Bode 图，不能只画幅频特性。
2. 根轨迹、Bode、Nyquist 与时域响应图必须来自 Octave 或高保真脚本数据，不手工描图。
3. 辨识图中的阶跃输入、高保真响应、辨识响应统一使用左侧坐标轴，并采用中文标题、中文坐标轴和中文图例。
4. 方波任务必须使用 $+45^\circ/-45^\circ$，半周期 $300\,\mathrm{s}$，总时长 $1200\,\mathrm{s}$。
5. 回转任务必须从 $60\,\mathrm{s}$ 开始单调增加到 $360^\circ$，总时长 $780\,\mathrm{s}$。
6. 所有控制器对比图使用同一航速 $15.0\,\mathrm{m/s}\approx29.2\,\mathrm{kn}$。
7. `4-7-cover-comic.png` 与 `4-7-info.png` 属于保留资产，不由代码直出脚本覆盖。
8. 课程级 `slides.pdf`、`course.mp4`、`audio.m4a` 只在媒体链接文档登记，后续由人工或外部制作流程回写。

## 5. 后续外部制作说明

- `4-7-intro-video-prompts.md` 已改为“高保真任务证据、低阶辨识结构、传统与优化设计、扰动噪声边界”四镜头导入。
- `4-7-slides.pdf` 建议按学生讲义顺序组织：真实任务、分段辨识、指标翻译、传统设计、优化设计、扰动噪声、传统结构局限。
- `4-7-course.mp4` 建议突出“同一控制器在辨识模型与高保真模型上的差异”，避免算法宣传式叙事。
