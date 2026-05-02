# 5-4 多模态资源设计

## 资源总表

| 编号 | 文件 | 类型 | 引用于 | 状态 | 教学作用 |
| --- | --- | --- | --- | --- | --- |
| 01 | `media/processed/5-4-cover-comic.png` | 位图 | 学生讲义首页 | 已有保留资产 | 用多格情节引入“模型预测与真实对象逐渐分离”的问题感 |
| 02 | `media/processed/5-4-model-mismatch-prediction.png` | 代码直出图 | 学生讲义 §1.3、知识卡 | 已生成 | 展示名义模型、真实对象和数据修正预测之间的误差差异 |
| 03 | `media/processed/5-4-mpc-principle-block.png` | TikZ 线框图 | 学生讲义 §2.1、知识卡 | 已生成 | 说明 MPC 的预测、优化、约束和滚动执行关系 |
| 04 | `media/processed/5-4-data-driven-mpc-block.png` | TikZ 线框图 | 学生讲义 §3.2、知识卡 | 已生成 | 说明闭环数据进入预测模型更新后仍保留 MPC 约束结构 |
| 05 | `media/processed/5-4-model-parameter-drift.png` | 代码直出图 | 学生讲义 §5.2、知识卡 | 已生成 | 展示真实参数漂移、名义参数和在线推断参数的差异 |
| 06 | `media/processed/5-4-mpc-drift-comparison.png` | 代码直出图 | 学生讲义 §5.2、知识卡 | 已生成 | 对比传统固定控制、名义模型 MPC 与数据驱动模型 MPC 的闭环表现 |
| 07 | `media/processed/5-4-info.png` | 信息图 | 学生讲义总结前 | 已有保留资产 | 汇总模型驱动、MPC、数据驱动与验证代价之间的迁移关系 |
| 08 | `media/raw/5-4-intro-video-prompts.md` | 视频提示词 | 课堂导入 / 后续互动页入口 | 已有 | 用 15 秒视频建立模型依赖松动和代价交换的视觉情境 |
| 09 | `media/raw/5-4-cover-comic-prompt.md` | 位图提示词 | 封面漫画后续再生成或复核 | 本轮新增 | 为封面漫画保留可复用提示词 |

## 代码直出媒体与源文件

本单元数值图采用 Octave 导出数据、Python/matplotlib 排版的两段式流程：

- `media/raw/generate_5_4_simulation_data.m`
- `media/raw/render_5_4_simulation_figures.py`
- `media/raw/generated-data/5-4-model-mismatch-prediction.csv`
- `media/raw/generated-data/5-4-mpc-drift-comparison.csv`
- `media/raw/generated-data/5-4-mpc-drift-metrics.csv`
- `media/raw/generated-data/5-4-model-fit-summary.txt`

正式图像中的指标应以生成数据为准。讲义中使用的最大预测误差、IAE、平均误差和舵角触边比例不另造数值。

## 线框图源文件

本单元结构图已保留 TikZ 源文件：

- `media/raw/5-4-mpc-principle-block.tex`
- `media/raw/5-4-data-driven-mpc-block.tex`

这两张图服务解释性结构，不替代数值验证图。

## AI 生成式媒体与提示词

- `5-4-cover-comic.png` 和 `5-4-info.png` 为保留资产文件名，现有成品不由代码脚本覆盖。
- `5-4-cover-comic-prompt.md` 用于后续重新生成或复核封面漫画。
- `5-4-intro-video-prompts.md` 已存在，后续成品为 `5-4-intro-video.mp4`，进入审查阶段后再确认可用性。

## 互动课程设计可直接复用的媒体

互动课程设计阶段可以复用以下静态媒体作为页面证据：

- `5-4-model-mismatch-prediction.png`
- `5-4-mpc-principle-block.png`
- `5-4-data-driven-mpc-block.png`
- `5-4-model-parameter-drift.png`
- `5-4-mpc-drift-comparison.png`

若互动课需要动态控件，应以这些静态图的默认模型、默认曲线和默认指标为镜像，不另造一套数值口径。

## 制作与维护说明

- 多媒体阶段不生成 `5-4-slides.pdf`、`5-4-course.mp4`、`5-4-audio.m4a` 成品，只在 `media/processed/5-4-media.md` 中保留链接节名。
- 若后续重绘数值图，先运行 Octave 数据脚本，再运行 Python 排版脚本，并复核讲义中的指标是否同步。
- 若后续替换封面漫画或信息图，只替换对应保留资产，不改动代码直出脚本输出目标。
