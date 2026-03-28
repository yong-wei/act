# 多模态资源设计 | 单元 2-2：时域响应基础——从响应曲线到动态性能指标

> **资源总数**：20 项
> **说明**：本课讲义与媒体命名已统一切换到 `2-2-...` 前缀；以下设计与 `handout.md`、`media/` 目录保持一致，避免后续回写再次改路径。

## 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/6性能指标_控制效果评价/README.md` | `pptx` | handout 导入 / 指标总览 / summary | 改写吸收 | `必融入` | 只吸收“为什么稳定还不够”“典型输入”“指标标注骨架”，不照搬旧课件页序 |
| `course-content/resource-library/pptx/7.1衰减振荡_欠阻尼二阶系统/README.md` | `pptx` | handout 二阶系统 / interactive step-07~12 | 改写吸收 + 直接复用图片 | `必融入` | 只服务标准二阶对象与欠阻尼响应家族，不把课堂主线扩张为设计约束推演 |
| `course-content/resource-library/ship-control-cases/sections/3.1-3.3` | `ship-case` | interactive step-14 / handout 对照框 | 改写吸收 + 直接复用图片 | `可选融入` | 只服务同一时域语言在不同船舶对象上的对照观察，不提前进入稳态误差与控制器选型 |
| 思政案例 | `civics` | 本轮不接入 | 暂不采用 | `排除` | `2-2` 当前没有必须接入的思政节点，避免让对象建立课失焦 |

---

## 资源总表

| 编号 | 文件名 / 标识 | 生成方式 | 引用于 | 优先级 |
|:---:|---------------|----------|--------|:---:|
| 1 | 2-2-td-01-time-domain-input-response-overview.svg | 代码直出图 | handout §2.1 / interactive step-05 | P0 |
| 2 | 2-2-td-02-first-order-step-time-constant.svg | 代码直出图 | handout §2.2 / interactive step-06 | P0 |
| 3 | 2-2-td-03-second-order-response-families.svg | 代码直出图 | handout §2.3 / interactive step-08 | P0 |
| 4 | 2-2-td-04-time-domain-indices-annotated.svg | 代码直出图 | handout §2.4 / interactive step-12 | P0 |
| 5 | 2-2-td-05-example-response-with-indices.svg | 代码直出图 | handout §3.1 / interactive step-13 | P1 |
| 6 | 2-2-td-06-time-spec-to-pole-region.svg | 代码直出图 | handout 附录 / teacher note | P2 |
| 7 | 2-2-ship-01-three-case-time-response-gallery.png | 资源库二次编排图 | interactive step-14 / teacher-handout 对照讨论 | P1 |
| 8 | 2-2-cover-comic.png | AI 生成位图 | handout 信息节后 / 讲义封面导入 | P0 |
| 9 | 2-2-intro-video.mp4 | AI 生成视频 | 课堂开场 / interactive 首页导入 | P1 |
| 10 | 2-2-info.png | 讲义信息图 | 位图 | handout 总结后 / 附录前 | P0 |
| 11 | 2-2-slides.pdf | 生成式课件 | PDF | 课件导出配套 | P1 |
| 12 | 2-2-course.mp4 | 课程内容视频 | 视频 | 课堂播放 / 课后复习 | P1 |
| 13 | 2-2-audio.m4a | 课程音频播客 | 音频 | 课后复习 | P1 |
| 14 | ic-01-pretest-distribution | 前端绘制 | interactive step-04 | P1 |
| 15 | ic-02-first-order-time-slider | 前端绘制 | interactive step-06 | P0 |
| 16 | ic-03-second-order-family-switcher | 前端绘制 | interactive step-08 | P0 |
| 17 | ic-04-index-overlay | 前端绘制 | interactive step-12 | P0 |
| 18 | ic-05-metric-calculator | 前端绘制 | interactive step-13 | P1 |
| 19 | ic-06-ai-compare-workspace | 前端绘制 | interactive step-14 | P0 |
| 20 | ic-07-metric-to-pole-plane | 前端绘制 | interactive step-15 | P0 |

---

## AI 导入媒体规格

### 资源 cover-comic | 讲义封面漫画
- **原料**：`media/raw/2-2-cover-comic-prompt.md`
- **成品**：`media/processed/2-2-cover-comic.png`
- **引用位置**：`handout.md` 信息节后、正文前
- **用途**：用于学生版讲义首页导入，在进入正式引入前先建立问题意识和阅读兴趣。
- **备注**：采用多格漫画封面方案；对话全中文且简洁，格子允许错落，但必须用箭头标明阅读顺序。

### 资源 intro-video | 15 秒导入视频
- **原料**：`media/raw/2-2-intro-video-prompt.md`
- **成品**：`media/processed/2-2-intro-video.mp4`
- **引用位置**：课堂开场 / `interactive-page.md` 首页导入区域
- **用途**：在开课最初 15 秒快速建立“稳定了为什么还不够”的问题情境，激发学生兴趣。
- **备注**：本单元已选定“高质量 2D 动漫课堂科幻风格”作为唯一视频风格，用来兼顾讲义封面漫画的亲和感与控制课堂的动态感；提示词中必须按该单一风格组织镜头、运镜和转场。

---

## 代码直出图规格

### 资源 td-01 | 典型输入与响应对象概览
- **存放**：`media/raw/2-2-td-01-time-domain-input-response-overview.py` -> `media/processed/2-2-td-01-time-domain-input-response-overview.svg`
- **内容**：左侧并列绘制单位脉冲、单位阶跃、单位斜坡输入；右侧对应给出典型输出曲线，并以高亮框突出“本课聚焦单位阶跃”。
- **重点标注**：输入名称、时间轴、输出响应对象、单位阶跃高亮标签。
- **绘制建议**：Matplotlib 子图 2×3 布局；颜色上阶跃输入用高亮青色，其余灰蓝。

### 资源 td-02 | 一阶系统阶跃响应与时间常数
- **存放**：`media/raw/2-2-td-02-first-order-step-time-constant.py` -> `media/processed/2-2-td-02-first-order-step-time-constant.svg`
- **内容**：在同一坐标系中绘制两到三条不同 $T$ 值下的一阶阶跃响应曲线，并标记 $t=T$ 时达到终值的 $63.2\%$。
- **重点标注**：终值虚线、$0.632K$ 水平线、$T$ 垂线。
- **绘制建议**：主图显示曲线，右上角加小注释框“$T$ 越大，响应越慢”。

### 资源 td-03 | 二阶系统四种响应家族
- **存放**：`media/raw/2-2-td-03-second-order-response-families.py` -> `media/processed/2-2-td-03-second-order-response-families.svg`
- **内容**：四联图并排展示无阻尼、欠阻尼、临界阻尼、过阻尼响应。
- **重点标注**：每个子图标出阻尼比区间，并用一句工程语言描述曲线特点。
- **绘制建议**：统一横纵坐标范围，便于学生直接比较“是否振荡、谁更快、谁更平”。

### 资源 td-04 | 动态性能指标标注图
- **存放**：`media/raw/2-2-td-04-time-domain-indices-annotated.py` -> `media/processed/2-2-td-04-time-domain-indices-annotated.svg`
- **内容**：在一条标准欠阻尼响应曲线上同时标出 $t_r$、$t_p$、$M_p$、$t_s$、稳态值和误差带。
- **重点标注**：
  - 第一次达到终值的时刻；
  - 第一个峰值；
  - 2\% 误差带；
  - 超调高度。
- **绘制建议**：用不同颜色箭头对应不同指标，避免一图混乱。

### 资源 td-05 | 例题一响应曲线与指标结果
- **存放**：`media/raw/2-2-td-05-example-response-with-indices.py` -> `media/processed/2-2-td-05-example-response-with-indices.svg`
- **内容**：使用例题一参数 $\zeta=0.4, \omega_n=5$ 绘制曲线，并在图侧给出计算结果卡片。
- **重点标注**：四指标数值与曲线上对应位置一一对应。
- **绘制建议**：左图曲线、右图结果摘要，强化“数值不是漂浮的”。

### 资源 td-06 | 指标反推极点区域
- **存放**：`media/raw/2-2-td-06-time-spec-to-pole-region.py` -> `media/processed/2-2-td-06-time-spec-to-pole-region.svg`
- **内容**：在 $s$ 平面中画出阻尼比射线与 $\sigma$ 垂线，阴影表示满足超调量和调节时间双约束的可行区域。
- **当前位阶调整**：本轮重审后降为教师补充或附录资源，不再作为课堂主讲主图。
- **重点标注**：
  - 阻尼比射线；
  - $\operatorname{Re}(s)=-\sigma_0$ 垂线；
  - 可行区域阴影；
  - “时域指标 -> 极点区域”说明框。
- **绘制建议**：使用浅青色半透明填充阴影区，便于后续在 interactive 中复用视觉语言。

### 资源 ship-01 | 三类船舶对象时域响应对照图组
- **来源**：
  - `course-content/resource-library/ship-control-cases/sections/3.1-船舶航向控制时域分析实例.md`
  - `course-content/resource-library/ship-control-cases/sections/3.2-船舶横摇减摇鳍控制时域分析实例.md`
  - `course-content/resource-library/ship-control-cases/sections/3.3-船载稳定平台控制系统时域分析实例.md`
- **建议成品**：`media/processed/2-2-ship-01-three-case-time-response-gallery.png`
- **内容**：把三类船舶对象各选 1 张最能体现“快慢 / 振荡 / 指标适用性差异”的时域曲线，重排成统一坐标风格的三栏对照图。
- **引用位置**：`interactive-page.md` step-14、`teacher-handout.md` 例题二或总结前。
- **重点标注**：
  - 对象名称；
  - 该图主要体现的动态特征；
  - 是否适合直接用本课指标语言描述；
  - 一句“为什么”的工程提示。
- **制作原则**：
  - 优先二次编排资源库现有图，不要求本轮重算模型；
  - 若原图风格不统一，应改为重新裁切、统一标题、统一标注和统一留白；
  - 该图组服务课堂比较，不服务稳态误差、控制器选择或设计优化讨论。

---

## 互动前端绘制需求

### 资源 ic-01 | 前测分布条形图
- **引用位置**：`interactive-page.md` step-04
- **图表类型**：单题正确率 / 选项分布条形图
- **交互行为**：教师端实时看班级统计，学生端只看到个人作答状态
- **推荐实现**：Recharts `BarChart`

### 资源 ic-02 | 一阶时间常数滑块联动
- **引用位置**：`interactive-page.md` step-06
- **图表类型**：折线图 + 辅助虚线
- **可变参数**：$T$，范围建议 `0.2 ~ 5.0`
- **交互行为**：拖动滑块时同时更新曲线、$63.2\%$ 标记与“快/慢”提示
- **推荐实现**：Canvas 或 Recharts，保证拖动流畅

### 资源 ic-03 | 二阶响应家族切换器
- **引用位置**：`interactive-page.md` step-08
- **图表类型**：四标签页或单图多状态切换
- **可变参数**：预设阻尼比组 `{0, 0.2, 1, 1.5}`
- **交互行为**：切换家族时同步显示阻尼比范围和一句工程解释

### 资源 ic-04 | 动态指标叠加标注器
- **引用位置**：`interactive-page.md` step-12
- **图表类型**：欠阻尼响应折线图 + 图层叠加
- **可变参数**：是否显示 $t_r / t_p / M_p / t_s$ 标注；误差带 2\% / 5\%
- **交互行为**：教师端可逐项揭示，学生端可手动开关重看

### 资源 ic-05 | 公式代入计算面板
- **引用位置**：`interactive-page.md` step-13
- **组件类型**：分栏计算器
- **输入项**：$\zeta$、$\omega_n$
- **输出项**：$\omega_d$、$t_r$、$t_p$、$M_p$、$t_s$
- **交互行为**：学生可逐格填写，提交后显示公式对应关系

### 资源 ic-06 | AI 对照工作区
- **引用位置**：`interactive-page.md` step-14
- **组件类型**：三栏布局（我的判断 / 资源对照 / AI 核验）
- **交互行为**：学生先写，再看船舶案例对照，最后请求 AI 只做“逻辑核验”
- **实现要求**：保留提示词模板，避免 AI 直接泄露最终答案

### 资源 ic-07 | 指标到极点联动面板
- **引用位置**：`interactive-page.md` step-15
- **图表类型**：复平面散点 / 阴影区域图
- **输入项**：指标名或参数名切换
- **输出项**：参数主控关系、极点趋势提示、后续模块指向
- **交互行为**：教师端逐项揭示“指标 -> 参数 -> 极点趋势”的轻量桥接，不把它做成完整设计面板

---

## 后续执行建议

1. 先生成 `2-2-td-01`~`2-2-td-04`，它们覆盖主讲内容与课堂展示主干；
2. 再生成 `2-2-td-05`，补齐标准对象例题；`2-2-td-06` 保留为附录/教师补充资源，不再放入主讲优先级；
3. `ic-02`、`ic-03`、`ic-04`、`ic-07` 是最有教学增益的互动组件，优先级高于一般答题面板；
4. AI 对照工作区要严格限制提示词模式：先预测、再验证、再反思。
