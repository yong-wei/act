# 5-5 多模态资源设计

## 资源总表

| 编号 | 文件 | 类型 | 引用于 | 状态 | 教学作用 |
| --- | --- | --- | --- | --- | --- |
| 01 | `media/processed/5-5-cover-comic.png` | 位图 | 学生讲义首页 | 保留资产待回写 | 用四格漫画引入“显式控制律可写性下降，但责任并未消失”的问题感 |
| 02 | `media/processed/5-5-explicit-vs-policy.png` | TikZ 线框图 | 学生讲义 §1.3、知识卡 | 已生成 | 对比显式控制律与学习策略在动作来源、证据来源和验证责任上的差异 |
| 03 | `media/processed/5-5-rl-toy-demo.png` | 代码直出图 | 学生讲义 §2.2、知识卡 | 已生成 | 展示横向误差修正中随机动作、显式比例修正和学习策略的行为差异 |
| 04 | `media/processed/5-5-rl-entry-risk-matrix.png` | TikZ 线框图 | 学生讲义 §3.2、知识卡 | 已生成 | 把强化学习进入条件、补证据状态和暂不进入状态组织成风险矩阵 |
| 05 | `media/processed/5-5-rl-heading-control-training.png` | 代码直出图 | 学生讲义 §4.6、知识卡 | 已生成 | 展示航向控制策略训练回报、安全外壳触发和 RL 调度 PID 训练过程 |
| 06 | `media/processed/5-5-rl-heading-control-edge-scenarios.png` | 代码直出图 | 学生讲义 §4.10、知识卡 | 已生成 | 展示目标航向、扰动和对象参数漂移，作为评价响应曲线的读图前提 |
| 07 | `media/processed/5-5-rl-heading-control-evaluation.png` | 代码直出图 | 学生讲义 §4.10、知识卡 | 已生成 | 对比 PID、直接控舵 RL、安全外壳 RL 和 RL 调度 PID 的闭环表现 |
| 08 | `media/processed/5-5-info.png` | 信息图 | 学生讲义总结前 | 保留资产待回写 | 汇总强化学习进入条件、收益、风险、安全保护与工程入口 |
| 09 | `media/raw/5-5-intro-video-prompts.md` | 视频提示词 | 课堂导入 / 后续互动页入口 | 已有 | 以复杂任务压迫显式控制律、策略学习出现和风险标签同步点亮作为导入情境 |
| 10 | `media/raw/5-5-cover-comic-prompt.md` | 位图提示词 | 封面漫画后续生成或复核 | 已有 | 为四格封面漫画保留可复用提示词 |

## 代码直出媒体与源文件

本单元数值图由 `media/raw/generate_rl_policy_simulation.py` 生成。该脚本同时完成简化横向误差修正仿真、航向控制训练仿真、边缘场景构造和四路线评价图排版。

已登记的生成数据：

- `media/raw/generated-data/5-5-rl-policy-simulation.json`
- `media/raw/generated-data/5-5-heading-control-trace.json`

讲义中使用的 RMS 误差、最大超调、调节时间、平均舵角、平均舵速和安全退化次数，应以该脚本输出和生成数据为准，不另造数值。

## 线框图源文件

本单元结构图保留 TikZ 源文件：

- `media/raw/5-5-explicit-vs-policy.tex`
- `media/raw/5-5-rl-entry-risk-matrix.tex`

两张图服务概念判断，不替代数值仿真图。若后续重绘，应保持“责任差异”和“进入条件矩阵”两个教学动作不变。

## AI 生成式媒体与提示词

- `5-5-cover-comic.png` 和 `5-5-info.png` 为保留资产文件名，代码直出脚本不得覆盖。
- `5-5-cover-comic-prompt.md` 已按四格漫画要求完成，可用于后续生成或复核封面漫画。
- `5-5-intro-video.mp4` 已发布到 `media/processed/`。原提示词仍保留为原料。

## 互动课程设计可直接复用的媒体

互动课程设计阶段可以复用以下静态媒体作为页面证据：

- `5-5-explicit-vs-policy.png`
- `5-5-rl-toy-demo.png`
- `5-5-rl-entry-risk-matrix.png`
- `5-5-rl-heading-control-training.png`
- `5-5-rl-heading-control-edge-scenarios.png`
- `5-5-rl-heading-control-evaluation.png`

若互动课需要动态控件，应以这些静态图的默认模型、默认曲线和默认指标为镜像，不另造数值口径。

## 制作与维护说明

- 多媒体阶段不生成 `5-5-slides.pdf`、`5-5-course.mp4`、`5-5-audio.m4a` 成品，只在 `media/processed/5-5-media.md` 中保留链接节名。
- 若后续重绘数值图，先运行 `generate_rl_policy_simulation.py`，再复核讲义和教师讲义中的指标是否同步。
- 若后续替换封面漫画或信息图，只替换对应保留资产，不改动代码直出脚本输出目标。
