# 5-6 多模态资源设计

## 资源总表

| 编号 | 文件 | 类型 | 引用于 | 状态 | 教学作用 |
| --- | --- | --- | --- | --- | --- |
| 01 | `media/processed/5-6-cover-comic.png` | 位图 | 学生讲义首页 | 保留资产 | 用冷链仓库评审场景引入“同一任务、三条路线”的判断压力 |
| 02 | `media/processed/5-6-temperature-log.png` | 代码直出图 | 学生讲义 §1、教师讲义、BOPPPS | 已生成 | 展示 48 小时温度、开门、入库和压缩机动作日志 |
| 03 | `media/processed/5-6-two-state-thermal-model.png` | 代码直出图 | 学生讲义 §2、知识卡 | 已生成 | 解释空气温度和货品核心温度两个状态的作用与换热关系 |
| 04 | `media/processed/5-6-three-route-comparison.png` | 代码直出图 | 学生讲义 §3.4、教师讲义、BOPPPS | 已生成 | 比较 E2 入库高峰中三路线的温度曲线、恢复时间、能耗、切换和验证负担 |
| 05 | `media/processed/5-6-risk-verification-matrix.png` | 代码直出图 | 学生讲义 §4.3、知识卡 | 已生成 | 说明经典、数据驱动、策略监督层的证据要求差异 |
| 06 | `media/processed/5-6-info.png` | 信息图 | 学生讲义总结前 | 保留资产 | 汇总冷链方法选择的五类证据和三路线判断结果 |
| 07 | `media/raw/5-6-intro-video-prompts.md` | 视频提示词 | 课堂导入 / 后续互动入口 | 已有 | 以冷链仓库评审台、温度曲线、开门扰动和三路线方案卡形成导入情境 |
| 08 | `media/raw/5-6-cover-comic-prompt.md` | 位图提示词 | 封面漫画后续生成或复核 | 已生成 | 为冷链同题比较封面漫画保留可复用提示词 |

## 代码直出媒体与源文件

本单元数值图采用两段式流程生成：

1. `media/raw/generate_5_6_cold_chain_benchmark.m` 生成三场景三路线的固定种子仿真日志、指标表和模型参数。
2. `media/raw/render_5_6_cold_chain_figures.py` 读取仿真输出并渲染正式图片。

已登记的代码直出媒体：

- `5-6-temperature-log.png`
- `5-6-two-state-thermal-model.png`
- `5-6-three-route-comparison.png`
- `5-6-risk-verification-matrix.png`

讲义、教师讲义和 BOPPPS 中涉及的温度峰值、恢复时间、能耗、切换次数和证据要求，应以这些图和对应指标表为同一口径。

## AI 生成式媒体与提示词

- `5-6-cover-comic.png` 和 `5-6-info.png` 为保留资产文件名，代码直出脚本不得覆盖。
- `5-6-cover-comic-prompt.md` 用于后续生成或复核封面漫画；画面应采用冷链仓库、评审台、温度曲线和方案卡，不使用可识别影视动漫角色。
- `5-6-intro-video.mp4` 已发布到 `media/processed/`。原提示词仍保留为原料。

## 课堂与资料使用方式

| 使用环节 | 推荐媒体 | 使用方式 |
| --- | --- | --- |
| 导入 | `5-6-intro-video.mp4` | 用闲聊自控导入片提出路线选择问题 |
| 模型解释 | `5-6-two-state-thermal-model.png` | 先读空气温度，再读货品核心温度，最后读压缩机作用路径 |
| 三路线比较 | `5-6-three-route-comparison.png` | 重点读 E2 中恢复时间、能耗、切换和路线验证负担 |
| 方法选择 | `5-6-risk-verification-matrix.png` | 说明证据要求等级不是标准控制性能指标，而是方法迁移证据维度 |
| 总结 | `5-6-info.png` | 回收五类证据和方法选择说明卡 |

## 互动课程设计可复用的媒体

后续互动设计阶段可以复用以下静态媒体作为页面证据：

- `5-6-temperature-log.png`
- `5-6-two-state-thermal-model.png`
- `5-6-three-route-comparison.png`
- `5-6-risk-verification-matrix.png`

若后续需要动态控件，应保持这些静态图中的模型、扰动、指标和结论口径，不另造数值。

## 制作与维护说明

- 多媒体阶段不生成 `5-6-slides.pdf`、`5-6-course.mp4`、`5-6-audio.m4a` 成品，只在 `media/processed/5-6-media.md` 中保留链接节名。
- 若后续重绘数值图，先运行 Octave 仿真脚本，再运行 Python 渲染脚本，并同步检查讲义、教师讲义和 BOPPPS 中的指标。
- 若后续替换封面漫画或信息图，只替换对应保留资产，不改动代码直出脚本输出目标。
