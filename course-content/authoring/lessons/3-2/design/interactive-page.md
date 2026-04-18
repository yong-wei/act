# 互动页面设计 | 单元 3-2：劳斯判据——从高阶系统稳定判定到参数可行域

## 全课总览

| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生实践分钟 | 学生页预览 |
| --- | --- | --- | --- | --- | --- | --- |
| step-01 | 回到地图——从纯极点语言走向稳定边界 | `map_hero_slide` | 路径图 + 任务卡 | `none` | 0 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01` |
| step-02 | 先看主对象——极点迁移图提出了哪三个问题 | `figure_question_board` | 主图 + 三问卡 + 二选一 | `binary_choice` | 4 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02` |
| step-03 | 前测——不求根判稳、特殊情况与区域收紧 | `question_stack` | 标题卡 + 三题卡组 | `quiz_group` | 6 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03` |
| step-04 | 普通劳斯表——固定 `k=4` 时怎样从第一列读出稳定性 | `worked_example_reveal` | 题面卡 + 显影链 + 双作答卡 | `activity_cards` | 8 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04` |
| step-05 | 带参数劳斯表——稳定区间怎样从第一列条件链中写出 | `worked_example_reveal` | 参数对象 + 不等式链 + 双作答卡 | `activity_cards` | 10 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05` |
| step-06 | 边界点回到复平面——`k=-2`、`18`、`22` 分别对应什么根结构 | `figure_mapping_workspace` | 参数表 + 极点迁移图 + 双作答卡 | `activity_cards` | 7 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06` |
| step-07 | 首位为 0——`ε` 连续化为什么只服务于符号判断 | `worked_example_reveal` | 短例题面 + 显影链 + 双作答卡 | `activity_cards` | 8 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07` |
| step-08 | 全零行——辅助方程怎样把对称根结构重新写出来 | `worked_example_reveal` | 短例题面 + 规则卡 + 双作答卡 | `activity_cards` | 8 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08` |
| step-09 | 劳斯现象到时域——极点结构怎样改写响应形态 | `table_figure_workspace` | 对应表 + 阶跃图 + 双作答卡 | `activity_cards` | 6 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09` |
| step-10 | 劳斯现象到频域——峰值抬高、理想共振与低频抬升如何区分 | `figure_table_workspace` | 公式卡 + Bode 图 + 双作答卡 | `activity_cards` | 6 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10` |
| step-11 | 变量平移——把 `\operatorname{Re}(s)<-0.5` 转成普通劳斯判定 | `worked_example_reveal` | 约束卡 + 平移链 + 双作答卡 | `activity_cards` | 9 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11` |
| step-12 | 后测——判稳、特殊情况与区域约束能否连成一条链 | `post_quiz_stack` | 标题卡 + 三题卡组 | `quiz_group` | 6 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12` |
| step-13 | 收束——从稳定判定走向参数设计入口 | `summary_infographic` | 四列表 + 信息图 | `none` | 0 | `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13` |

> 可追踪学生实践合计：`78` 分钟。

## 证据单元升级决策表

| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
| --- | --- | --- | --- | --- | --- | --- |
| 路径定位与主问题 | `## 一、引入：高阶系统稳定分析为什么需要劳斯判据` | `step-01` `step-02` | 地图页 + 主图三问页 | 路径图、主问题、`3-2-pole-migration.png` | “先看边界，再谈迁移”的入口判断 | 学生首屏就知道当前对象是高阶特征方程边界问题 |
| 固定参数普通劳斯表 | `### 2.1` `### 2.2` `### 2.3` `### 2.4` | `step-04` | 完整例题页 + 逐步显影 | `D(s)=s^4+5s^3+9s^2+11s+6`、完整劳斯表、第一列、数值求根结论 | 递推链与“第一列全正”结论 | 题面常显，显影只隐藏步骤，不隐藏对象和结论目标 |
| 带参数劳斯表与稳定区间 | `### 3.1` `### 3.2` | `step-05` | 完整例题页 + 双卡作答 | `D(s,k)`、参数劳斯表、不等式链、`-2<k<18` | `s^0` 行条件与区间合并过程 | 学生能在同页看到条件链、区间和作答卡的对应关系 |
| 边界点与极点迁移 | `### 3.3` `### 3.4` `### 3.5` | `step-06` | 参数点映射页 | `k=-2,18,22`、求根表、迁移图 | 原点根与纯虚根的差异 | 学生能同时看到参数点、根结构与图上位置 |
| 首位为 0 短例 | `### 4.1` | `step-07` | 完整例题页 + 逐步显影 | `D_1(s)`、`ε` 替换、符号序列、求根结果 | `ε` 的角色与两次变号结论 | 不把 `ε` 写成真实参数，也不跳过符号判断 |
| 全零行短例 | `### 4.2` `### 4.3` | `step-08` | 完整例题页 + 规则卡 | `D_2(s)`、辅助方程一般式、`A(s)=s^2+1`、`A'(s)=2s` | “先构造辅助方程，再判根结构” | 学生能独立说出何时用辅助方程、何时不用 |
| 劳斯到时域 | `### 5.1` `### 5.2` | `step-09` | 对应表 + 阶跃图页 | 表 3、`3-2-step-comparison.png` | 稳定、临界、失稳的时域差异 | 图和表必须同页，且先有表后有图 |
| 劳斯到频域 | `### 5.3` `### 5.4` | `step-10` | 公式卡 + Bode 图 + 三域总表 | `\omega=1\,\text{rad/s}`、`3-2-bode-magnitude.png`、表 4 | 峰值抬高、理想共振、低频抬升的分辨 | 学生能从频域回译到极点结构 |
| 变量平移与更强约束 | `### 6.1` `### 6.2` `### 6.3` `### 6.4` | `step-11` | 完整例题页 + 逐步显影 | `s=z-\frac12`、平移后多项式、平移后劳斯表、`-\frac38<k<4` | 新旧区间对比与“无解约束”提示 | 同页必须出现旧区间、新区间和几何解释 |
| 总结与核验 | `## 七、自学核验建议` | `step-12` `step-13` | 后测页 + 收束页 | 四条核验主线、信息图 `3-2-info.png` | 判稳、特殊情况、区域约束三线合并 | 后测与收束明确分离，不混成同一页 |

## 混合证据顺序表

| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 |
| --- | --- | --- | --- |
| `step-01` | 路径图与今日任务 | 本课主问题 | 无互动 |
| `step-02` | 极点迁移图 | 三个判断问题与一句结论桥接 | 二选一判断 |
| `step-03` | 后测标题卡与三题题面 | 常见误区提示 | 提交与统计 |
| `step-04` | 固定对象题面与前两行表格 | 普通劳斯表显影步骤与第一列结论 | 两张独立作答卡与参考答案 |
| `step-05` | 带参数对象与完整劳斯表 | 第一列不等式链与稳定区间 | 区间卡和漏条件判断卡 |
| `step-06` | 参数点求根表 | 极点迁移图与边界说明 | 参数-根结构映射卡 |
| `step-07` | `D_1(s)` 题面 | `b_1=0`、`ε` 替换、符号序列 | 右半平面根数判断卡 |
| `step-08` | `D_2(s)` 题面与零行现象 | 辅助方程一般式、本例导数替换 | 辅助方程填写卡与根结构判断卡 |
| `step-09` | 劳斯现象到极点结构表 | 阶跃响应图与图后解释 | 现象-时域匹配卡 |
| `step-10` | 频域线索公式卡 | Bode 图与三域总表 | 频域现象辨识卡 |
| `step-11` | 更强约束题面 | 变量平移链、平移后劳斯表、新旧区间对比 | 新区间填写卡与参数点判断卡 |
| `step-12` | 后测标题卡 | 三题作答区 | 答案揭示与统计 |
| `step-13` | 四列表总结 | 信息图与出口句 | 无互动 |

## 步骤 01｜回到地图——从纯极点语言走向稳定边界

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：模块路径图
- `today-task`：任务卡
- `boundary-note`：边界提示卡

### 静态承载内容
- 固定高亮 `3-1 -> 3-2 -> 3-3 -> 4-1`
- 任务卡写明：高阶系统不显式求根时，怎样判断稳定、识别边界并写出参数可行域
- 边界提示卡写明：本课停留在劳斯判据、边界类型和区域约束，不进入根轨迹与整定

### 混合证据顺序
- 路径图
- 今日任务
- 边界提示

### 互动升级点
- 组件类型：`none`

### 教师控制
- 仅保留页面推进与路径高亮

### 学生默认状态
- 无作答区
- 页面打开即完整可读

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01`

### 脱离讲稿自包含检查
- 学生离开讲稿后，仍能知道这一课研究的是“高阶特征方程的稳定边界”，而不是单纯求根练习

## 步骤 02｜先看主对象——极点迁移图提出了哪三个问题

### 页面骨架
- 模板：`figure_question_board`
- 区域：`media` / `questions` / `interaction`

### 模块清单
- `pole-migration-figure`：`3-2-pole-migration.png`
- `three-questions`：三问卡
- `binary-choice`：二选一判断区

### 静态承载内容
- 主图完整呈现参数从 `k=-2` 到 `k=22` 的极点迁移
- 三问卡固定写明：
  - 哪一段参数仍保持稳定
  - 哪两个点恰好压在边界上
  - 只有特征方程时，怎样不靠图继续判断
- 结论桥接句写明：图像暴露了边界，但没有替代系数判稳

### 混合证据顺序
- 极点迁移图
- 三问卡
- 二选一判断

### 互动升级点
- 组件类型：`binary_choice`
- 题目：只看极点迁移图，是否已经足够写出参数可行域
- 选项：
  - A：足够，图上边界点已经全部给出
  - B：不够，还需要一套由特征方程系数直接判稳的方法
- 正确项：`B`

### 教师控制
- `发放作答` 与 `显示参考答案` 分离

### 学生默认状态
- 图与三问先完整可见
- 判断区默认可见

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-02`

### 脱离讲稿自包含检查
- 学生只看这一页，也能明确“图只是入口，真正的问题是如何把边界转成代数规则”

## 步骤 03｜前测——不求根判稳、特殊情况与区域收紧

### 页面骨架
- 模板：`question_stack`
- 区域：`title` / `question-stack` / `submit-bar`

### 模块清单
- `post-card`：本页任务卡
- `pretest-q1`：不求根判稳判断题
- `pretest-q2`：特殊情况辨识题
- `pretest-q3`：区域收紧理解题

### 静态承载内容
- 标题卡写明：本页只检查判断链是否已经形成
- 三道题题面全部明文呈现
- 误区提示列出：
  - 劳斯判据不是另一种求根法
  - 首位为 0 不等于全零行
  - 稳定区间不等于更强区域约束下的可行域

### 混合证据顺序
- 本页任务卡
- 三题题面
- 提交反馈区

### 互动升级点
- 组件类型：`quiz_group`
- 三题独立作答，不合并成一题综合判断

### 教师控制
- 可单独发放前测
- 可单独显示统计与答案

### 学生默认状态
- 三题默认可见
- 作答区默认可用

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-03`

### 脱离讲稿自包含检查
- 学生能够从题面直接知道本课后续会处理普通判稳、特殊情况和区域约束三条线

## 步骤 04｜普通劳斯表——固定 k=4 时怎样从第一列读出稳定性

### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`problem` / `derivation` / `activity` / `reference`

### 模块清单
- `problem-card`：完整题面卡
- `formula-card`：固定对象公式
- `reveal-steps`：普通劳斯表显影链
- `activity-card-a`：右半平面根数判断卡
- `activity-card-b`：方法意义解释卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 题面完整写明：取 `k=4`，对
  $$
  D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)
  $$
  列写普通劳斯表并判断稳定性
- 公式卡必须落地
  $$
  D(s)=s^4+5s^3+9s^2+11s+6
  $$
- 显影链依次给出前两行、`b_1`、`b_2`、`c_1`、完整劳斯表、第一列
  $$
  1,\ 5,\ \frac{34}{5},\ \frac{112}{17},\ 6
  $$
- 数值求根结果作为最后的交叉验证，不提前抢到步骤前面

### 混合证据顺序
- 完整题面
- 固定对象公式
- 劳斯表显影步骤
- 第一列结论
- 两张作答卡
- 参考答案

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `右半平面根数是多少`：`single_choice`
  - `为什么这一步已经能判稳而不是在显式求根`：`fill_text`
- 显影只控制递推步骤，不控制题面

### 教师控制
- `发放作答`
- `开放浏览`
- `教师逐步显影`
- `显示参考答案`

### 学生默认状态
- 题面与对象公式始终可见
- 显影步骤默认收缩
- 作答卡默认隐藏，教师发放后出现

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-04`

### 脱离讲稿自包含检查
- 学生只看这一页，也能完整知道对象、计算顺序、第一列的作用和最后的稳定结论

## 步骤 05｜带参数劳斯表——稳定区间怎样从第一列条件链中写出

### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`problem` / `derivation` / `activity` / `reference`

### 模块清单
- `problem-card`：完整题面卡
- `parametric-formula`：带参数对象公式卡
- `reveal-steps`：带参数劳斯表显影链
- `activity-card-a`：区间填写卡
- `activity-card-b`：漏条件判断卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 题面写明：保留参数 `k`，列写劳斯表并写出系统稳定区间
- 必须完整出现
  $$
  D(s,k)=s^4+5s^3+9s^2+(7+k)s+(2+k)
  $$
  以及带参数劳斯表、第一列不等式链和结论
  $$
  -2<k<18
  $$
- 显影链要明确：
  - `s^2` 行如何由前两行得到
  - `s^1` 行分式如何因式分解
  - 为什么 `s^0` 行不能遗漏

### 混合证据顺序
- 完整题面
- 带参数对象
- 参数劳斯表显影链
- 第一列不等式链
- 稳定区间
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `填写稳定区间`：`fill_text`
  - `哪一个条件最容易漏掉`：`single_choice`

### 教师控制
- `发放作答`
- `开放浏览`
- `教师逐步显影`
- `显示参考答案`

### 学生默认状态
- 对象公式始终可见
- 推导链默认收缩
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-05`

### 脱离讲稿自包含检查
- 学生能仅凭本页独立复现“第一列条件 -> 不等式链 -> 稳定区间”的顺序

## 步骤 06｜边界点回到复平面——k=-2、18、22 分别对应什么根结构

### 页面骨架
- 模板：`figure_mapping_workspace`
- 区域：`table` / `media` / `activity` / `reference`

### 模块清单
- `parameter-table`：参数点求根结果表
- `pole-migration-figure`：极点迁移图
- `activity-card-a`：参数与根结构匹配卡
- `activity-card-b`：边界差异解释卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 参数表至少列出 `k=12`、`k=18`、`k=22` 的求根结果与稳定性
- 图前说明写明：
  - `k=-2` 对应原点根
  - `k=18` 对应纯虚根
  - `k=22` 已出现右半平面共轭根
- 图后解释必须把“代数区间边界”与“极点穿越虚轴”联系起来

### 混合证据顺序
- 参数点求根表
- 极点迁移图
- 边界解释卡
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `把参数点与根结构做匹配`：`match`
  - `为什么两个边界点都在边界上却不是同一种临界状态`：`fill_text`

### 教师控制
- `发放作答`
- `开放浏览`
- `显示参考答案`

### 学生默认状态
- 参数表与主图先出现
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-06`

### 脱离讲稿自包含检查
- 学生能清楚回答“区间边界点对应什么根结构”，而不是只记住区间端点数值

## 步骤 07｜首位为 0——ε 连续化为什么只服务于符号判断

### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`problem` / `derivation` / `activity` / `reference`

### 模块清单
- `problem-card`：`D_1(s)` 题面卡
- `reveal-steps`：首位为 0 的显影链
- `activity-card-a`：右半平面根数判断卡
- `activity-card-b`：`ε` 作用说明卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 题面完整写明：
  $$
  D_1(s)=s^4+2s^3+3s^2+6s+5
  $$
- 显影链依次出现：
  - 前两行劳斯表
  - `b_1=0`、`b_2=5`
  - `s^2` 行首位为 0
  - `\varepsilon` 替换
  - `c_1=6-\frac{10}{\varepsilon}`
  - 第一列两次变号
  - 数值求根验证

### 混合证据顺序
- 完整题面
- 首位为 0 的出现位置
- `ε` 连续化
- 变号结论
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `右半平面根数是多少`：`single_choice`
  - `为什么 `\varepsilon` 不是系统真实参数`：`fill_text`

### 教师控制
- `发放作答`
- `开放浏览`
- `教师逐步显影`
- `显示参考答案`

### 学生默认状态
- 题面始终可见
- 显影步骤默认收缩
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-07`

### 脱离讲稿自包含检查
- 学生能知道这类情况为何继续递推，以及判断目标始终是“第一列符号变化”

## 步骤 08｜全零行——辅助方程怎样把对称根结构重新写出来

### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`problem` / `rule` / `derivation` / `activity` / `reference`

### 模块清单
- `problem-card`：`D_2(s)` 题面卡
- `rule-card`：辅助方程一般规则卡
- `reveal-steps`：全零行显影链
- `activity-card-a`：辅助方程填写卡
- `activity-card-b`：根结构判断卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 题面完整写明：
  $$
  D_2(s)=s^4+2s^3+2s^2+2s+1
  $$
- 规则卡必须明确：
  - 全零行出现在 `s^m` 行时，辅助方程由上一行系数构成
  - 先写 `A(s)`，再写 `A'(s)`，再替换零行
- 显影链依次给出零行、`A(s)=s^2+1`、`A'(s)=2s`、替换后劳斯表、纯虚根结论

### 混合证据顺序
- 完整题面
- 辅助方程一般规则
- 本例显影链
- 两张作答卡
- 参考答案

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `写出本例辅助方程`：`fill_text`
  - `本例对应哪一种根结构`：`single_choice`

### 教师控制
- `发放作答`
- `开放浏览`
- `教师逐步显影`
- `显示参考答案`

### 学生默认状态
- 题面与规则卡始终可见
- 步骤默认收缩
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-08`

### 脱离讲稿自包含检查
- 学生能分清“首位为 0”与“全零行”分别在何处触发、为何不能用同一算法处理

## 步骤 09｜劳斯现象到时域——极点结构怎样改写响应形态

### 页面骨架
- 模板：`table_figure_workspace`
- 区域：`table` / `media` / `activity` / `reference`

### 模块清单
- `structure-table`：劳斯结论到极点结构对应表
- `step-response-figure`：`3-2-step-comparison.png`
- `activity-card-a`：现象匹配卡
- `activity-card-b`：边界区分卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 表格必须至少列出：
  - 第一列全正 -> 全部极点在左半平面
  - 第一列两次变号 -> 两个右半平面根
  - 全零行 -> 关于原点对称的根结构
  - 原点根 -> 保留不衰减模态
- 图后解释要写明：极点越逼近虚轴，衰减越慢；进入右半平面后，振荡包络开始放大

### 混合证据顺序
- 对应表
- 阶跃响应图
- 图后解释
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `把劳斯现象与时域曲线做匹配`：`match`
  - `原点根与纯虚根在时域上最主要的差异是什么`：`fill_text`

### 教师控制
- `发放作答`
- `开放浏览`
- `显示参考答案`

### 学生默认状态
- 表格与图先完整可见
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-09`

### 脱离讲稿自包含检查
- 学生能把“劳斯现象”翻译成“极点结构”和“时域表现”，而不是只背诵表格字面

## 步骤 10｜劳斯现象到频域——峰值抬高、理想共振与低频抬升如何区分

### 页面骨架
- 模板：`figure_table_workspace`
- 区域：`formula` / `media` / `table` / `activity` / `reference`

### 模块清单
- `formula-card`：频域线索公式卡
- `bode-figure`：`3-2-bode-magnitude.png`
- `three-domain-table`：三域总表
- `activity-card-a`：频域现象辨识卡
- `activity-card-b`：三域回译卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 公式卡必须写明：
  - 纯虚根对应频率点可能出现理想共振
  - 原点根首先改写低频特性
  - 接近边界时峰值抬高
- 三域总表至少列出：劳斯现象、极点结构、时域表现、频域线索四列

### 混合证据顺序
- 频域线索公式卡
- Bode 图
- 三域总表
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `哪一种频域现象对应纯虚根`：`single_choice`
  - `为什么靠近稳定边界时峰值会抬高`：`fill_text`

### 教师控制
- `发放作答`
- `开放浏览`
- `显示参考答案`

### 学生默认状态
- 公式卡、图与总表先可见
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-10`

### 脱离讲稿自包含检查
- 学生能把频域异常直接回译到极点位置与稳定边界，而不是把图当成孤立现象

## 步骤 11｜变量平移——把 Re(s)<-0.5 转成普通劳斯判定

### 页面骨架
- 模板：`worked_example_reveal`
- 区域：`problem` / `derivation` / `activity` / `reference`

### 模块清单
- `problem-card`：更强约束题面卡
- `shift-formula-card`：变量平移公式卡
- `reveal-steps`：平移后显影链
- `activity-card-a`：新区间填写卡
- `activity-card-b`：参数点是否越界判断卡
- `reference-answer`：参考答案卡

### 静态承载内容
- 题面必须完整写明：要求全部极点满足
  $$
  \operatorname{Re}(s)<-0.5
  $$
- 公式卡必须完整出现
  $$
  s=z-\frac12,\qquad \tilde D(z,k)=D\left(z-\frac12,k\right)
  $$
- 显影链依次给出平移后多项式、平移后劳斯表、第一列条件、新旧区间对比
  $$
  -2<k<18 \quad \rightarrow \quad -\frac38<k<4
  $$
- 最后一段静态说明写明：若进一步要求 `\operatorname{Re}(s)<-1`，主对象因固定极点 `s=-1` 而无解

### 混合证据顺序
- 完整题面
- 变量平移公式卡
- 平移后劳斯表显影链
- 新旧区间对比
- 两张作答卡

### 互动升级点
- 组件类型：`activity_cards`
- 作答卡：
  - `填写更强约束下的可行域`：`fill_text`
  - `判断 `k=4` 是否仍满足新约束并说明理由`：`single_choice`

### 教师控制
- `发放作答`
- `开放浏览`
- `教师逐步显影`
- `显示参考答案`

### 学生默认状态
- 题面与平移公式始终可见
- 推导步骤默认收缩
- 作答卡默认隐藏

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-11`

### 脱离讲稿自包含检查
- 学生能明确“区域收紧不是另起一套方法，而是把目标区域平移回虚轴后继续用劳斯表”

## 步骤 12｜后测——判稳、特殊情况与区域约束能否连成一条链

### 页面骨架
- 模板：`post_quiz_stack`
- 区域：`title` / `question-stack` / `submit-bar`

### 模块清单
- `post-card`：后测任务卡
- `post-q1`：右半平面根数题
- `post-q2`：辅助方程题
- `post-q3`：区域收紧题

### 静态承载内容
- 标题卡写明：答案不仅看结果，也看关键词是否完整
- 三道题分别对应：
  - 第一列变号与右半平面根数
  - 全零行为何先写辅助方程
  - 更强约束为何使可行域缩小

### 混合证据顺序
- 本页任务卡
- 三道题题面
- 提交反馈与答案揭示

### 互动升级点
- 组件类型：`quiz_group`
- 两道客观题 + 一道解释题

### 教师控制
- `发放作答`
- `显示统计`
- `显示参考答案`

### 学生默认状态
- 三题默认可见
- 作答区默认可用

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-12`

### 脱离讲稿自包含检查
- 学生能从题面直接回忆整条方法链，而不是只记住某一页局部计算

## 步骤 13｜收束——从稳定判定走向参数设计入口

### 页面骨架
- 模板：`summary_infographic`
- 区域：`summary-table` / `infographic` / `exit-note`

### 模块清单
- `four-column-summary`：四列表
- `course-infographic`：`3-2-info.png`
- `exit-note`：出口句卡

### 静态承载内容
- 四列表固定写明：
  - 普通劳斯表回答“是否稳定”
  - 特殊情况回答“边界是什么根结构”
  - 三域回译回答“边界在图上和响应里怎样出现”
  - 变量平移回答“怎样把稳定推进成设计可行域”
- 出口句写明：根轨迹与设计比较只能在劳斯判据先圈定的可行域内继续展开

### 混合证据顺序
- 四列表
- 信息图
- 出口句

### 互动升级点
- 组件类型：`none`

### 教师控制
- 仅保留页面推进

### 学生默认状态
- 无作答区
- 页面打开即完整可读

### 学生页预览路径
- `/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-13`

### 脱离讲稿自包含检查
- 学生在不回看讲义的情况下，也能说出本课为什么是“参数设计入口”而非只是一套判稳算式
