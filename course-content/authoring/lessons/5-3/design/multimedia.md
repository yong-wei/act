# 5-3 多模态资源设计

## 资源总表

| 编号 | 文件 | 类型 | 引用于 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 01 | `5-3-cover-comic.png` | 代码直出封面图 | 学生讲义、教师讲义首页 | 已完成 | 当前为可复现封面图，呈现单回路展开为 MASS 链路；后续可替换为提示词生成的漫画版。 |
| 02 | `5-3-mass-coordination-chain.png` | 线框/示意图 | 讲义一、教师版、课堂导入 | 已完成 | 展示感知、估计、规划、控制、执行和监督的信息流。 |
| 03 | `5-3-control-position-in-chain.png` | 线框图 | 讲义三、教师版 | 已完成 | 标出控制层在复杂自主系统链路中的位置。 |
| 04 | `5-3-sensor-noise-filter-chain.png` | 代码直出图 | 讲义四、教师版 | 已完成 | 展示传感器噪声经反馈链传播及滤波缓解。 |
| 05 | `5-3-sensor-delay-heading-track.png` | 代码直出图 | 讲义四、教师版 | 已完成 | 对比测量延迟造成的航向滞后和航迹偏差。 |
| 06 | `5-3-planning-path-control-comparison.png` | 代码直出图 | 讲义五、教师版 | 已完成 | 对比最短路径、频繁重规划和平滑可行路径对控制输出的影响。 |
| 07 | `5-3-actuator-limits-response-track.png` | 代码直出图 | 讲义六、教师版 | 已完成 | 展示执行器幅值和速率限制对控制量、响应与航迹的影响。 |
| 08 | `5-3-diagnostic-sequence-infographic.png` | AI/信息图 | 讲义七、教师版 | 已完成 | 组织 MASS 链路诊断顺序。 |
| 09 | `5-3-autonomous-avoidance-scene.png` | AI 场景图 | 讲义八 | 已完成 | 展示自主避碰中的感知、估计、规划与控制传播场景。 |
| 10 | `5-3-turning-radius-saturation-comparison.png` | 代码直出图 | 讲义九、教师版 | 已完成 | 对比不同转弯半径下舵角饱和与实际航迹。 |
| 11 | `5-3-automation-levels-scene.png` | AI 场景图 | 讲义十、教师版 | 已完成 | 展示 MASS 四类自动化程度的责任主体差异。 |
| 12 | `5-3-info.png` | 代码直出信息图 | 讲义小结 | 已完成 | 收束 MASS 链路责任边界；提示词保留供后续升级视觉版本。 |
| 13 | `5-3-intro-video.mp4` | 视频 | 互动课程入口页 | 待外部生成 | 已有中文提示词，内容为单回路展开为链路。 |
| 14 | `5-3-slides.pdf` | 课程课件 | 课程资源入口 | 待登记 | 进入审查阶段后登记成品链接。 |
| 15 | `5-3-course.mp4` | 课程录像 | 课程资源入口 | 待登记 | 进入审查阶段后登记成品链接。 |
| 16 | `5-3-audio.m4a` | 课程音频 | 课程资源入口 | 待登记 | 进入审查阶段后登记成品链接。 |

## 互动课程设计可直接复用的媒体

- 导入页：`5-3-mass-coordination-chain.png` 与 `5-3-control-position-in-chain.png`。
- 信息质量页：`5-3-sensor-noise-filter-chain.png`、`5-3-sensor-delay-heading-track.png`。
- 规划可行性页：`5-3-planning-path-control-comparison.png`。
- 执行约束页：`5-3-actuator-limits-response-track.png`。
- 链路诊断页：`5-3-diagnostic-sequence-infographic.png`。
- 避碰案例页：`5-3-autonomous-avoidance-scene.png`、`5-3-turning-radius-saturation-comparison.png`。
- 自动化责任页：`5-3-automation-levels-scene.png`。

## 已有提示词与源文件

- 封面漫画提示词：`media/raw/5-3-cover-comic-prompt.md`。
- 小结信息图提示词：`media/raw/5-3-info-prompt.md`。
- 导入视频提示词：`media/raw/5-3-intro-video-prompts.md`。
- 链路线框源：`media/raw/5-3-mass-coordination-chain.tex`、`media/raw/5-3-control-position-in-chain.tex`。
- 传感器链路线框源：`media/raw/5-3-sensor-noise-filter-chain.tex`。
- 仿真数据脚本：`media/raw/generate_5_3_simulation_data.m`。
- 曲线排版脚本：`media/raw/render_5_3_simulation_figures.py`。

## 制作与维护说明

5-3 的数值媒体围绕同一 MASS 链路语义展开：上游信息质量、规划参考可实现性、执行器约束和避碰转弯半径。后续互动课程设计若需要动态图，应复用这些图的参数边界，不另起一套与讲义结论不一致的曲线。
