# 5-2 多模态资源设计

## 资源总表

| 编号 | 文件 | 类型 | 引用于 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 01 | `5-2-cover-comic.png` | AI 位图 | 学生讲义、教师讲义首页 | 已完成 | 以漫画方式呈现非线性边界与三种观察工具。 |
| 02 | `5-2-nonlinear-tool-comparison.png` | 代码直出图 | 讲义一、教师版、互动导入 | 已完成 | 对照局部线性化、相平面、描述函数看到的不同证据。 |
| 03 | `5-2-phase-plane-limit-cycle.png` | 代码直出图 | 讲义四、教师版、相平面互动页 | 已完成 | Van der Pol 振子相平面轨迹与极限环。 |
| 04 | `5-2-static-nonlinearity-characteristics.png` | 代码直出图 | 讲义五、教师版、描述函数公式页 | 已完成 | 常见非线性输入输出关系与参数标注。 |
| 05 | `5-2-nonlinear-feedback-block.png` | TikZ 线框图 | 讲义六、教师版 | 已完成 | 线性部分与非线性环节串联的负反馈结构。 |
| 06 | `5-2-small-perturbation-method.png` | TikZ 图 | 讲义六、教师版、互动显影页 | 已完成 | 微小扰动法判断两个交点的稳定性。 |
| 07 | `5-2-negative-inverse-summary.png` | 代码直出图 | 讲义六、教师版、互动对照页 | 已完成 | 常见非线性负倒描述函数曲线与参数影响。 |
| 08 | `5-2-example-relay-limit-cycle.png` | 代码直出图 | 例题 1 | 已完成 | 理想继电交点与短脉冲触发自振仿真。 |
| 09 | `5-2-example-saturation-gain-compare.png` | 代码直出图 | 例题 2 | 已完成 | 饱和环节中线性增益改变自振条件。 |
| 10 | `5-2-ship-rudder-actuator-case.png` | TikZ/示意图 | 船舶舵机案例 | 已完成 | 舵机结构与饱和、死区来源。 |
| 11 | `5-2-ship-rudder-actuator-case-sim.png` | 代码直出图 | 船舶舵机案例 | 已完成 | 死区饱和交点判断与短脉冲仿真。 |
| 12 | `5-2-info.png` | AI 信息图 | 讲义小结、互动总结页 | 已完成 | 非线性系统最小分析入口总结。 |
| 13 | `5-2-intro-video.mp4` | 视频 | 互动课程入口页 | 已完成 | 闲聊自控 Remotion 导入片已发布。 |
| 14 | `5-2-slides.pdf` | 课程课件 | 课程资源入口 | 待后续补充 | 进入审查阶段后登记成品链接。 |
| 15 | `5-2-course.mp4` | 课程录像 | 课程资源入口 | 待后续补充 | 进入审查阶段后登记成品链接。 |
| 16 | `5-2-audio.m4a` | 课程音频 | 课程资源入口 | 待后续补充 | 进入审查阶段后登记成品链接。 |

## 互动课程设计可直接复用的媒体

- 导入页：`5-2-cover-comic.png`、`5-2-nonlinear-tool-comparison.png`。
- 局部线性化页：复用 `5-2-nonlinear-tool-comparison.png` 中的左侧证据，互动实现时可做工作点滑块镜像。
- 相平面页：`5-2-phase-plane-limit-cycle.png`，互动实现时可保留同一模型并开放初始条件。
- 描述函数页：`5-2-static-nonlinearity-characteristics.png` 与 `5-2-negative-inverse-summary.png`。
- 微小扰动页：`5-2-small-perturbation-method.png`，适合做逐层显影，先显示包围区域，再显示交点和 B/C 扰动点。
- 例题页：`5-2-example-relay-limit-cycle.png`、`5-2-example-saturation-gain-compare.png`。
- 案例页：`5-2-ship-rudder-actuator-case.png`、`5-2-ship-rudder-actuator-case-sim.png`。
- 总结页：`5-2-info.png`。

## 已有提示词

- 封面漫画提示词：`media/raw/5-2-cover-comic-prompt.md`。
- 导入视频提示词：`media/raw/5-2-intro-video-prompts.md`。

## 制作与维护说明

数值曲线由 `media/raw/generate_5_2_describing_function_data.m` 生成数据，并由 `media/raw/render_5_2_describing_function_figures.py` 排版。结构图和微小扰动图保留 TikZ 源文件。互动课程设计阶段若需要动态图，应以这些静态图的默认参数和视觉语义为基线，不另起一套不一致的曲线。
