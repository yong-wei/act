━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
互动页面设计 | 单元 3-9：稳定—动态—稳态综合映射实验
技术栈：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 文档职责
- 本文件是供作者态审阅的互动页面蓝图，只描述页面结构、静态证据、互动模块、教师控制、学生访问语义与学生页预览口径。
- 同目录 [interactive-contract.yaml](./interactive-contract.yaml) 为机读契约；两者必须逐步骤同名、同序、同语义。
- 本文件不是讲义摘要，不把关键公式、指标表、比较维度、作答题面或控制语义留给实现阶段自行补写。
- 本课默认预览口径固定为学生演示页；教师端只查看步骤骨架、聚合结果与同步状态，不代替真实学生页预览。

## 表述规则
- 页面顺序服从 `handout.md` 的证据链，不为视觉包装改写逻辑顺序。
- 图片只在它本身就是首个证据时才允许靠前；验证图不得抢在公式、口径卡和判断句之前。
- 教师控制固定拆成 `release_activity`、`open_browse`、`teacher_step_reveal`、`reveal_reference_answer` 四类语义。
- 学生作答默认隐藏优先；若页面必须保留占位，再退化为锁定态。
- 每一步至少回答四个问题：对象是什么、正在判断什么、关键证据在哪里、这一页如何接回“模块 4 入口判断”主线。
- 后测与收束分离：后测只检查判断链是否形成，收束页只负责总结与去向，不混写。

## 全课总览
| 步骤 | 标题 | 页面模板 | 主体布局 | 互动组件 | 学生页预览 |
|---|---|---|---|---|---|
| step-01 | 回到地图：固定统一对象、比较链与本课边界 | `map_hero_slide` | 路径图 + 对象卡 + 比较链 + 边界卡 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01` |
| step-02 | 前测：先贴任务标签，不先报控制器名称 | `question_stack` | 四题前测 + 标签提醒卡 + 提交条 | `quiz_group` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02` |
| step-03 | 基准锚点：综合折中基线必须先读完整 | `design_compare_workspace` | 基准 `2×2` 图 + 指标表 + 结论卡 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03` |
| step-04 | 零点线补强：动态改善先在哪些证据里出现 | `design_compare_workspace` | 控制器卡 + 对照图 + 指标表 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04` |
| step-05 | 稳态路线先改看斜坡：弱积分先暴露哪类收益与代价 | `formula_media_compare` | 读图口径卡 + 控制器卡 + 图 + 对照表 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05` |
| step-06 | 强积分与积分校正：低频收益与中频代价怎样重新分配 | `matrix_lab_board` | 双控制器卡 + 双图 + 三版本矩阵表头 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06` |
| step-07 | 滞后对照：稳态改善不只一条路，但程度与代价不同 | `comparison_panel_with_reason` | 滞后控制器卡 + 图 + 对照卡 + 统一结论 + 作答卡 | `activity_card_set` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07` |
| step-08 | 综合映射工作区：把六个版本写回同一张机制地图 | `mapping_workspace` | 综合映射表 + 短报告模板 + 入口判断卡 + 提交区 | `table_builder` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08` |
| step-09 | 后测：是否已经形成“先贴任务标签再跨域复核”的判断链 | `assessment_card_grid` | 四题后测 + 错因标签 + 点评条 | `quiz_card_grid` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-09` |
| step-10 | 收束与去向：只把 3-9 的出口带到模块 4 的入口 | `summary_route_board` | 出口结论卡 + 信息图 + 去向卡 | `none` | `/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-10` |

## 证据单元升级决策表
| 证据类型 | 来源锚点 | 目标步骤 | 升级方式 | 保留元素 | 不得删减内容 | 验收点 |
|---|---|---|---|---|---|---|
| 路径定位、统一对象与比较链 | `## 一`、`## 二` | step-01 | 静态保留 | `3-8 -> 3-9 -> 4-1` 路径、`P(s)`、`C_0(s)`、`L_0(s)`、比较链、边界卡 | “只做首轮任务判断，不给完整最优方案” | 首屏直接看到路径图、对象公式、比较链和边界卡 |
| 任务标签误区 | `## 一` | step-02 | 题组互动 | 三类任务标签、四类误判题干、固定提醒 | “先贴任务标签，不先报控制器名称” | 四道题干与提醒卡在未作答状态下完整可见 |
| 基准版完整证据链 | `## 三` | step-03 | 图表保留 + 小卡作答 | `3-9-baseline-quad.png`、指标表、四象限读法、综合折中结论 | 不得只留图或只留表；“统一锚点”不得缺失 | 图、表、结论和作答卡同屏 |
| 零点线补强证据链 | `## 四` | step-04 | 公式保留 + 对照作答 | `C_z(s)`、`3-9-zero-line-quad.png`、关键指标、动态改善结论 | “不直接承担更准任务”不得删 | 公式、图、表、作答卡同页 |
| 改看斜坡的读图口径与弱积分样例 | `## 五`、`### 5.1`、`### 5.2` | step-05 | 口径卡 + 图表 + 小卡作答 | 为什么改看斜坡、`C_{i1}(s)`、`3-9-integral-weak-quad.png`、基准/弱积分对照表 | “基准对象对单位阶跃已零静差”不得删 | 口径卡、公式、图、表与作答卡同屏 |
| 强积分与积分校正的双重证据 | `### 5.3`、`### 5.4` | step-06 | 双图比较 + 三版本矩阵 | `C_{i2}(s)`、`C_{ic}(s)`、两张 `2×2` 图、三版本矩阵表头 | 不得只保留强积分或只保留积分校正；“中频整理拉回”不得缺失 | 双公式、双图、矩阵表头先于作答卡出现 |
| 滞后对照与积分家族统一结论 | `### 5.5`、`### 5.6` | step-07 | 图表保留 + 判断卡 | `C_{\mathrm{lag}}(s)`、`3-9-lag-quad.png`、积分/滞后对照维度、四条统一结论 | “压小误差”和“压到零”差别不得删 | 公式、图、对照卡、统一结论和作答卡同页 |
| 综合映射表与短报告模板 | `## 六`、`课堂实践提交单` | step-08 | 工作区升级 | 六版本映射表头、短报告模板、模块 4 入口判断卡 | 表头、模板、入口判断三者都不得只留空壳 | 表头、模板和提交区同页，且表头先于输入区 |
| 后测题组 | `BOPPPS: P3` | step-09 | 题组互动 | 四道后测题、错因标签 | 后测不得与总结共页 | 四题独立卡片并排可见 |
| 模块 4 去向与本讲出口 | `## 七`、`本讲小结` | step-10 | 静态收束 | 三类入口判断回收、`3-9-info.png`、去向卡 | 不得越级写成完整设计结论 | 本页只做收束与去向，不出现评分互动 |

## 混合证据顺序表
| 步骤 | 先出现什么 | 再出现什么 | 最后出现什么 | 必须同屏内容 | 不得折叠内容 |
|---|---|---|---|---|---|
| step-03 | 基准 `2×2` 图与基线结论 | 指标表与四象限读法 | 四张判断作答卡 | 图、表、结论卡 | 指标表 |
| step-04 | 零点线控制器公式 | 对照图与关键指标 | 三张判断作答卡 | 公式、图、表 | 控制器公式 |
| step-05 | “为什么改看斜坡”口径卡 | 弱积分公式、图与对照表 | 三张判断作答卡 | 口径卡、公式、图、表 | 口径卡 |
| step-06 | 强积分与积分校正公式 | 双图与三版本矩阵表头 | 三张比较作答卡 | 双公式、双图、矩阵表头 | 矩阵表头 |
| step-07 | 滞后公式与对照维度卡 | 滞后图与统一结论卡 | 两张判断作答卡 | 公式、图、对照卡、统一结论 | 对照维度卡 |
| step-08 | 综合映射表头 | 六行版本模板与短报告模板 | 模块 4 入口判断卡与提交区 | 表头、模板、入口判断卡 | 表头 |
| step-09 | 四题后测题干 | 错因标签 | 提交与点评条 | 四题卡片、错因标签 | 任一题干 |

## 讲义核心内容映射
| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |
|---|---|---|---|---|---|---|---|
| `## 一、为什么模块 3 结束前要整合三种语言 / ## 二、统一对象与统一读图口径` | concept+formula | `P(s)`、`C_0(s)`、`L_0(s)`、比较链、本课边界 | step-01 | `static` | 无 | 路径图 / 对象卡 / 比较链卡 | 对象公式与边界卡必须首屏可见 |
| `## 一、为什么模块 3 结束前要整合三种语言` | misconception | 三类任务标签、四类误判题干 | step-02 | `static+quiz` | 题组只用于暴露误区，不替代题干 | 标签提醒卡 | 未作答状态下题干完整可见 |
| `## 三、任务一：基准版本给出哪一类基线` | comparison | 基准图、指标表、四象限读法、综合折中结论 | step-03 | `static+cards` | 四张小卡分别填写任务标签、首个风险、首个观察域、判断句 | `3-9-baseline-quad.png` | 图、表、结论与卡片同页 |
| `## 四、任务二：零点线补强如何优先改善动态` | formula+comparison | `C_z(s)`、对照图、关键指标、动态改善结论 | step-04 | `static+cards` | 三张小卡分别写收益域、代价域、为何不承担更准任务 | `3-9-zero-line-quad.png` | 公式和“动态改善”结论不得缺失 |
| `## 五 / ### 5.1 / ### 5.2` | concept+comparison | 改看斜坡口径、`C_{i1}(s)`、弱积分图、对照表 | step-05 | `static+cards` | 三张小卡分别写收益域、代价域、是否改型别 | `3-9-integral-weak-quad.png` | 口径卡不得被图替代 |
| `### 5.3 / ### 5.4` | comparison+matrix | `C_{i2}(s)`、`C_{ic}(s)`、两图、三版本矩阵表头 | step-06 | `static+cards` | 三张小卡分别判断谁收益最强、谁代价最大、谁把中频拉回 | `3-9-integral-strong-quad.png` / `3-9-integral-corrected-quad.png` | 矩阵表头必须先于卡片 |
| `### 5.5 / ### 5.6` | comparison+summary | `C_{\mathrm{lag}}(s)`、滞后图、积分/滞后对照维度、四条统一结论 | step-07 | `static+cards` | 两张小卡分别判断压小误差与压到零路径 | `3-9-lag-quad.png` | 统一结论与对照维度必须同页 |
| `## 六 / 课堂实践提交单` | table+report | 综合映射表头、六个版本行、短报告模板、入口判断卡 | step-08 | `workspace` | 表格填写 + 短报告 + 入口判断联合提交 | 综合映射表 | 表头先于输入区，入口判断单独成卡 |
| `## 七、通向 4-1 的入口判断` | assessment | 四道入口判断题、错因标签 | step-09 | `quiz` | 仅检查判断链，不越级到整定 | 后测题组 | 后测单独成页 |
| `## 本讲小结` | summary | 出口结论卡、信息图、去向卡 | step-10 | `static` | 无 | `3-9-info.png` | 本页只做收束与去向 |

## 步骤 01｜回到地图：固定统一对象、比较链与本课边界

### 页面骨架
- 模板：`map_hero_slide`
- 区域：`header` / `lead` / `summary`

### 模块清单
- `stage-map`：高亮 `3-8 -> 3-9 -> 4-1`
- `object-card`：统一对象公式卡
- `comparison-chain-card`：比较链卡
- `boundary-card`：本课边界卡

### 静态承载内容
- 路径图固定高亮 `3-8 -> 3-9 -> 4-1`。
- 统一对象公式必须完整出现：
$$
P(s)=\frac{0.01715}{s(s+0.1)(s+2.14375)}
$$
$$
C_0(s)=2.25
$$
$$
L_0(s)=C_0(s)P(s)=\frac{0.0385875}{s(s+0.1)(s+2.14375)}
$$
- 比较链固定写成：
$$
\text{结构变化}
\rightarrow
\text{根轨迹第一信号}
\rightarrow
\text{时域结果}
\rightarrow
\text{频域解释}
\rightarrow
\text{任务标签}
$$
- 边界卡固定写明：
  - 本课不新增控制机制；
  - 本课不直接给完整最优方案；
  - 本课只输出模块 4 的首轮任务判断。

### 混合证据顺序
- 先出现路径图与对象卡。
- 再出现比较链卡。
- 最后出现边界卡。

### 互动升级点
- 组件类型：`none`
- 学生任务：只阅读，不提交。

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 学生默认状态
- 全部静态内容默认可见。
- 无作答区，无标准答案区。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道当前统一对象、比较顺序与课程边界。
- 页面不依赖教师口头说明补充“为什么还不能直接选最优方案”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-01`
- 对齐要求：对象公式、比较链和边界卡必须首屏可见。

## 步骤 02｜前测：先贴任务标签，不先报控制器名称

### 页面骨架
- 模板：`question_stack`
- 区域：`question-stack` / `tag-card` / `submit-bar`

### 模块清单
- `pretest-q1`：想更快一点时先回看哪条机制线
- `pretest-q2`：想更准一点时先问什么
- `pretest-q3`：收益会先在同一域暴露吗
- `pretest-q4`：带宽变大能否直接等同全面更好
- `task-label-card`：任务标签提醒卡

### 静态承载内容
- 固定任务标签三类：
  - 更偏动态改善
  - 更偏稳态改善
  - 更偏综合折中
- 固定提醒：
  - 先贴任务标签，再回看机制线；
  - 不先报控制器名称；
  - 不只写收益，不省略代价。

### 混合证据顺序
- 先完整呈现四道题干。
- 再呈现任务标签提醒卡。
- 最后呈现提交条。

### 互动升级点
- 组件类型：`quiz_group`
- 学生任务：完成四道前测题并首贴任务标签。
- 反馈规则：允许重提一次；教师端区分首答与重提。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：可切换整组答案与错因标签

### 学生默认状态
- 题干默认可见。
- 作答区默认可用，无需先开放浏览权限。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道本课先判断“任务类型”，不是先背控制器名称。
- 四道题各自明确在检查哪一类误判，不依赖教师补充题意。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-02`
- 对齐要求：四题和任务标签提醒卡必须同页，未作答状态下题干完整可见。

## 步骤 03｜基准锚点：综合折中基线必须先读完整

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `baseline-quad`：基准 `2×2` 图
- `baseline-metrics`：指标表
- `baseline-summary-card`：基线结论卡
- `baseline-activity-cards`：四张判断卡

### 静态承载内容
- 固定图片：`3-9-baseline-quad.png`
- 指标表至少保留：闭环主导极点、另一闭环极点、阶跃超调量、调节时间、上升时间、峰值时间、相角裕度、增益裕度、增益交叉频率、单位斜坡稳态误差。
- 结论卡固定写明：
  - 基准版本是后续所有比较的统一锚点；
  - 它更偏“综合折中基线”；
  - 第一风险通常先落在相位余量与超调边界。
- 四象限读法必须完整出现：
  - 左上看阶跃响应；
  - 左下看根轨迹与闭环极点；
  - 右上看幅频与交叉频率；
  - 右下看相频与稳定裕度。

### 混合证据顺序
- 先出现基准 `2×2` 图和结论卡。
- 再出现指标表与四象限读法。
- 最后出现四张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：填写任务标签；
  - 卡 2：填写第一风险点；
  - 卡 3：填写首先观察的域；
  - 卡 4：写出一句话判断。
- 反馈规则：单卡提交，教师端统一揭示参考判断。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 图、表、结论卡默认可见。
- 四张作答卡默认隐藏，教师释放后逐卡可用。
- 学生不能直接看到参考判断。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道基准版为何不是“太差”，而是统一锚点。
- 页面已经交代图、表、结论与风险边界，不需要教师另行补“基准版的重要性”。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-03`
- 对齐要求：图、表、结论和四张判断卡必须同屏。

## 步骤 04｜零点线补强：动态改善先在哪些证据里出现

### 页面骨架
- 模板：`design_compare_workspace`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `zero-line-controller-card`：控制器公式卡
- `zero-line-quad`：零点线 `2×2` 图
- `zero-line-metrics`：关键指标表
- `zero-line-activity-cards`：三张判断卡

### 静态承载内容
- 控制器公式必须完整出现：
$$
C_z(s)=2.25\frac{12.5s+1}{2s+1}
$$
- 固定图片：`3-9-zero-line-quad.png`
- 关键指标至少保留：新增零点、新增极点、主要复极点位置、阶跃超调量、调节时间、相角裕度、增益裕度、增益交叉频率、单位斜坡稳态误差。
- 固定判断句：
  - 这一版优先回答“更快一些该怎么办”；
  - 它改写的是中频相位和根轨迹阻尼；
  - 它不直接承担“更准一些”的任务。

### 混合证据顺序
- 先出现控制器公式卡。
- 再出现对照图与关键指标表。
- 最后出现三张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：填写主要收益先在哪一域出现；
  - 卡 2：填写主要代价或边界先在哪一域暴露；
  - 卡 3：解释为什么它不直接承担“更准一些”的任务。
- 反馈规则：单卡提交，教师端统一揭示。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 公式、图和指标表默认可见。
- 三张作答卡默认隐藏，教师释放后可逐卡提交。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生仅看本页即可知道动态改善不是一句“更快了”，而是根轨迹、中频相位和超调共同改写。
- “它为什么不承担更准任务”已在本页静态区交代，不依赖教师追述。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-04`
- 对齐要求：控制器公式、图、指标表和三张判断卡必须同页。

## 步骤 05｜稳态路线先改看斜坡：弱积分先暴露哪类收益与代价

### 页面骨架
- 模板：`formula_media_compare`
- 区域：`lead` / `media` / `table` / `interaction`

### 模块清单
- `slope-reading-card`：为什么改看斜坡口径卡
- `weak-integral-controller-card`：弱积分公式卡
- `weak-integral-quad`：弱积分 `2×2` 图
- `baseline-weak-table`：基准/弱积分对照表
- `weak-integral-activity-cards`：三张判断卡

### 静态承载内容
- 读图口径卡必须完整写明：
  - 这一组左上角改看单位斜坡跟踪响应或误差响应；
  - 基准对象面对单位阶跃本来就是零静差；
  - 要看积分路线到底改善了什么，必须改看斜坡误差与慢极点代价。
- 控制器公式必须完整出现：
$$
C_{i1}(s)=2.25\left(1+\frac{1}{200s}\right)
$$
- 固定图片：`3-9-integral-weak-quad.png`
- 对照表至少保留：单位斜坡稳态误差、相角裕度、阶跃超调量、调节时间。
- 固定判断句：
  - 弱积分先让低频收益开始出现；
  - 同时引入贴近虚轴的慢极点；
  - 代价先在相位余量和收束拖尾上暴露。

### 混合证据顺序
- 先出现改看斜坡口径卡。
- 再出现公式卡、图和对照表。
- 最后出现三张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：填写首个收益域；
  - 卡 2：填写首个代价域；
  - 卡 3：判断是否改型别，并写一句理由。
- 反馈规则：单卡提交，教师统一揭示参考判断。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 口径卡、公式、图和对照表默认可见。
- 三张作答卡默认隐藏，教师释放后可逐卡提交。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可明白为何积分路线不能再盯单位阶跃终值。
- 页面已经说明“收益和代价为何会同时出现”，不依赖教师补讲积分原理。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-05`
- 对齐要求：口径卡、公式、图、表和三张判断卡必须同屏。

## 步骤 06｜强积分与积分校正：低频收益与中频代价怎样重新分配

### 页面骨架
- 模板：`matrix_lab_board`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `strong-integral-controller-card`：强积分公式卡
- `integral-corrected-controller-card`：积分校正公式卡
- `strong-integral-quad`：强积分 `2×2` 图
- `integral-corrected-quad`：积分校正 `2×2` 图
- `integral-matrix-header`：三版本矩阵表头
- `integral-activity-cards`：三张比较卡

### 静态承载内容
- 两个控制器公式必须完整出现：
$$
C_{i2}(s)=2.25\left(1+\frac{1}{40s}\right)
$$
$$
C_{ic}(s)=2.25\left(1+\frac{1}{40s}\right)\frac{20s+1}{2s+1}
$$
- 固定图片：
  - `3-9-integral-strong-quad.png`
  - `3-9-integral-corrected-quad.png`
- 三版本矩阵表头必须完整出现，至少包含：
  - 误差趋零速度
  - 相角裕度变化
  - 超调与调节时间变化
  - 是否把中频整理拉回
  - 任务标签
- 固定判断句：
  - 强积分说明“更准”可以更彻底，但代价会被放大；
  - 积分校正说明积分路线仍要配合中频整理；
  - 这一页不能只看低频收益，不看中频代价。

### 混合证据顺序
- 先出现两张控制器公式卡。
- 再出现双图与三版本矩阵表头。
- 最后出现三张比较卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：判断谁把低频收益做得最彻底；
  - 卡 2：判断谁把动态与裕度代价放得最明显；
  - 卡 3：判断谁已经把中频整理拉回可用区，并写理由。
- 反馈规则：单卡提交，不即时判对错，由教师统一揭示。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 双公式、双图和矩阵表头默认可见。
- 三张比较卡默认隐藏，教师释放后可逐卡提交。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道“继续堆积分”与“保留积分再做中频整理”不是同一回事。
- 三版本比较维度已经在静态表头中明示，不依赖教师口头补维度。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-06`
- 对齐要求：双公式、双图、矩阵表头和三张比较卡必须同页，且表头先于卡片。

## 步骤 07｜滞后对照：稳态改善不只一条路，但程度与代价不同

### 页面骨架
- 模板：`comparison_panel_with_reason`
- 区域：`media` / `table` / `interaction`

### 模块清单
- `lag-controller-card`：滞后控制器公式卡
- `lag-quad`：滞后 `2×2` 图
- `integral-lag-compare-card`：积分/滞后对照维度卡
- `family-summary-card`：积分家族统一结论卡
- `lag-activity-cards`：两张判断卡

### 静态承载内容
- 控制器公式必须完整出现：
$$
C_{\mathrm{lag}}(s)=4.5\frac{40s+1}{80s+1}
$$
- 固定图片：`3-9-lag-quad.png`
- 对照维度卡至少保留：
  - 是否改型别
  - 误差是压小还是压到零
  - 中频代价
  - 调节时间变化
- 统一结论卡固定写明：
  - 弱积分先看到收益，也先看到慢极点代价；
  - 强积分把精度收益和动态代价一起放大；
  - 积分校正说明积分路线必须配合中频整理；
  - 滞后说明稳态改善不只一条路，但改善程度与代价分布不同。

### 混合证据顺序
- 先出现滞后公式卡与对照维度卡。
- 再出现滞后图与统一结论卡。
- 最后出现两张判断卡。

### 互动升级点
- 组件类型：`activity_card_set`
- 学生任务：
  - 卡 1：判断“压小误差”更对应哪条路线；
  - 卡 2：判断“把单位斜坡误差压到零”更对应哪条路线，并写理由。
- 反馈规则：单卡提交，教师统一揭示。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换参考判断

### 学生默认状态
- 公式、图、对照维度卡和统一结论卡默认可见。
- 两张判断卡默认隐藏，教师释放后可提交。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道滞后不是“更弱积分”，而是另一条稳态改善路径。
- 页面已经交代“压小误差”和“压到零”差别，不依赖教师补充型别概念。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-07`
- 对齐要求：公式、图、对照卡、统一结论和两张判断卡必须同页。

## 步骤 08｜综合映射工作区：把六个版本写回同一张机制地图

### 页面骨架
- 模板：`mapping_workspace`
- 区域：`table` / `report` / `submit`

### 模块清单
- `mapping-template`：综合映射表
- `report-template-card`：短报告模板卡
- `module4-entry-card`：模块 4 入口判断卡
- `risk-note-card`：风险提醒卡
- `submit-zone`：提交区

### 静态承载内容
- 综合映射表头必须完整保留：
  - 版本
  - 任务标签
  - 结构变化
  - 根轨迹第一信号
  - 最先暴露收益的域
  - 最先暴露代价的域
  - 时域结果
  - 频域解释
  - 主要风险
  - 一句话判断
- 固定版本行：
  - 基准版本
  - 零点线补强
  - 弱积分
  - 强积分
  - 积分校正
  - 滞后对照（教师演示后复判）
- 短报告模板固定写明：
  - 我把 ________ 版本判为“________”路线，因为根轨迹上的第一信号是 ________；
  - 时域证据说明 ________，频域证据说明 ________；
  - 因此它虽然完成了 ________，但也把 ________ 提前暴露出来。
- 模块 4 入口判断卡固定列出三类口头需求：
  - 我希望它更快；
  - 我希望它更准；
  - 我希望既快又准但不能太冒进。

### 混合证据顺序
- 先出现综合映射表头与版本行模板。
- 再出现短报告模板与模块 4 入口判断卡。
- 最后出现提交区与风险提醒卡。

### 互动升级点
- 组件类型：`table_builder`
- 学生任务：完成综合映射表、短报告和模块 4 入口判断。
- 反馈规则：允许重提；教师端聚合漏项和高频误判。

### 教师控制
- `release_activity`：教师控制开放
- `open_browse`：页面静态内容默认可读
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换示例填法

### 学生默认状态
- 表头、模板和入口判断卡默认可见。
- 输入区默认隐藏，教师释放后可填写并重提。
- 示例填法默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道课堂提交物是什么、每列写什么、模块 4 入口判断要落到哪三类口头需求。
- 页面不依赖教师临时口述表头含义或短报告句式。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-08`
- 对齐要求：表头、模板、入口判断卡与提交区必须同页，且表头先于输入区。

## 步骤 09｜后测：是否已经形成“先贴任务标签再跨域复核”的判断链

### 页面骨架
- 模板：`assessment_card_grid`
- 区域：`quiz-grid` / `feedback-bar`

### 模块清单
- `posttest-q1`：想更快时先回看什么
- `posttest-q2`：想更准时为何不能默认最强积分
- `posttest-q3`：零点线补强为何不能直接判为最优
- `posttest-q4`：为什么 3-9 只给模块 4 入口判断
- `misconception-tags`：后测错因标签

### 静态承载内容
- 四道后测题干必须完整落页。
- 错因标签固定列出：
  - 先报控制器名称；
  - 只看一域不做复核；
  - 只写收益不写代价；
  - 越级写成完整设计结论。

### 混合证据顺序
- 先出现四道后测题卡。
- 再出现错因标签。
- 最后出现提交与点评条。

### 互动升级点
- 组件类型：`quiz_card_grid`
- 学生任务：完成四道后测题。
- 反馈规则：允许重提一次，教师端区分首答与重提。

### 教师控制
- `release_activity`：页面载入即开放
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：教师切换整组答案与错因标签

### 学生默认状态
- 四题题干默认可见。
- 作答区默认可用。
- 参考答案默认隐藏。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道后测是在检查“判断链是否形成”，不是检查参数整定。
- 四道题各自对应哪类错因，页面已明确可见。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-09`
- 对齐要求：四题卡片、错因标签和点评条必须同页，且后测不与总结共页。

## 步骤 10｜收束与去向：只把 3-9 的出口带到模块 4 的入口

### 页面骨架
- 模板：`summary_route_board`
- 区域：`summary` / `route`

### 模块清单
- `exit-summary-card`：本讲出口结论卡
- `info-card`：信息图卡
- `next-step-card`：模块 4 去向卡

### 静态承载内容
- 出口结论卡固定写明：
  - 想更快，先看根轨迹与中频相位能否支持主导极点左移；
  - 想更准，先分清是压小误差还是把某类误差压到零；
  - 想既快又准，必须把低频任务和中频整理一起看。
- 固定信息图：`3-9-info.png`
- 去向卡固定写明：
  - `3-9` 的出口是“先问对问题”；
  - `4-1` 才进入性能指标、工程约束与可行域表达。

### 混合证据顺序
- 先出现出口结论卡。
- 再出现信息图卡。
- 最后出现模块 4 去向卡。

### 互动升级点
- 组件类型：`none`
- 学生任务：只回看结论与去向，不提交。

### 教师控制
- `release_activity`：`not_applicable`
- `open_browse`：`not_applicable`
- `teacher_step_reveal`：`not_applicable`
- `reveal_reference_answer`：`not_applicable`

### 学生默认状态
- 全部静态内容默认可见。
- 无作答区，无评分互动。

### 本页脱离讲稿后的自包含检查
- 学生只看本页即可知道 `3-9` 的课程出口与 `4-1` 的入口边界。
- 页面不越级写成控制器选型或参数整定总结。

### 预览口径
- 学生页预览：`/interactive-learning/courses/unit-3-9-cross-domain-mapping-lab/student/demo?step=step-10`
- 对齐要求：本页只做收束与去向，不出现后测互动。
