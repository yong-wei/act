# 单元 4-1 多模态资源设计与采用清单

> **当前阶段目标**：围绕“任务表达入口课”组织正式媒体，优先支撑双案例回收、指标角色矩阵、可行域分层和任务表达卡填写，不把资源重心拖回控制器选型与参数整定。
> **命名前缀**：全部统一使用 `4-1-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/6性能指标_控制效果评价/README.md` | `pptx` | 指标角色矩阵、分类表、任务表达卡解释 | 改写吸收 | 必融入 | 只吸收指标分工和图示骨架，不沿用旧页序重讲“时域分析法” |
| `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md` | `ship-case` | 主场景 A、四联图联读、任务卡示例 | 改写吸收 + 直接复用图片思路 | 必融入 | 作为 `4-1` 主场景，不提前给出控制器方案 |
| `course-content/resource-library/ship-control-cases/sections/5.3-船载稳定平台控制系统频域分析.md` | `ship-case` | 对照案例 B、排序变化说明 | 改写吸收 + 直接复用图片思路 | 必融入 | 只做对照压重排，不喧宾夺主 |
| `course-content/resource-library/civics-cases/cases/05-裕度战略筑基者.md` | `civics` | 导入一句话、收束一句话 | 改写吸收 | 可选融入 | 只服务“先守边界、留足余量”的工程责任意识 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | 无 | 排除 | 排除 | 正式主落点在 `4-2/4-5`，不在 `4-1` 重开稳定裕度专题 |
| `course-content/resource-library/pptx/21三频段_各司其职/README.md` | `pptx` | 无 | 排除 | 排除 | `4-1` 只调用已有结论，不重讲三频段专题 |

---

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 用途 |
| :---: | --- | --- | --- | --- |
| 1 | `4-1-cover-comic.png` | 代码直出封面 | 已有 | 讲义首页导入 |
| 2 | `4-1-ship-heading-block.png` | 线框方框图 | 已有 | 主场景 A 控制对象框图 |
| 3 | `4-1-ship-heading-quad.png` | 跨域 `2×2` 图 | 已有 | 主场景 A 四联图联读 |
| 4 | `4-1-platform-pitch-block.png` | 线框方框图 | 已有 | 对照案例 B 控制对象框图 |
| 5 | `4-1-platform-pitch-quad.png` | 案例 B 综合图 | 已有 | 对照案例 B 的“Bode 双窄图 + 双根轨迹”联读 |
| 6 | `4-1-platform-pitch-rlocus-octave.png` | Octave 校核图 | 已有 | 根轨迹正确性核验参考，不直接上首页 |
| 7 | `4-1-indicator-role-matrix.png` | 信息图 | 已补 | 指标三分法：时域/频域/积分误差与角色对应 |
| 8 | `4-1-task-card-template.png` | 信息图 | 已补 | 页面与板书统一使用的任务表达卡模板 |
| 9 | `4-1-region-layering.png` | 信息图 | 已补 | `可行域 -> 满意域 -> 最优域` 分层示意 |
| 10 | `4-1-case-compare-summary.png` | 对照信息图 | 已补 | 客船与稳定平台的任务排序对照 |

---

## 3. 原始脚本与生成入口

### 3.1 案例数值生成

- **Octave 脚本**：`media/raw/generate_case_data.m`
- **用途**：
  - 生成案例 A / B 的阶跃、Bode、裕度、根轨迹原始数据；
  - 用 Octave 原生函数校验案例 B 全范围根轨迹。

### 3.2 最终排版出图

- **Python 脚本**：`media/raw/render_case_figures.py`
- **用途**：
  - 将 Octave 导出的数据重新排版为讲义中的 `2×2` 图；
  - 处理案例 B 的特殊布局：右上双窄图、左下全范围根轨迹、右下工作区根轨迹。

### 3.3 图形检查

- **检查脚本**：`media/raw/check_case_figure_layout.py`
- **用途**：
  - 检查根轨迹文本遮挡、分支连接和子图布局；
  - 复核案例 B 的根轨迹与原生 Octave 输出是否一致。

### 3.4 信息图补制

- **Python 脚本**：`media/raw/render_summary_infographics.py`
- **用途**：
  - 生成指标角色矩阵、任务表达卡模板、区域分层图、双案例排序对照图；
  - 统一 `4-1` 的任务表达口径，供讲义、互动页与知识卡复用。

---

## 4. 媒体设计约束

1. 正文核心媒体优先服务“任务写清楚”，不提前出现控制器类型选择器、参数滑杆或自动求优交互。
2. 跨域联读图默认按“时域响应、根轨迹、幅频图、相频/裕度图”组织；子图标题只写基本标题，不写方位提示。
3. 若根轨迹尺度差异明显，允许按案例 B 版式处理：双根轨迹 + 右上角压缩的幅频/相频窄图。
4. 所有根轨迹相关结论都以 Octave 原生 `rlocus()` 核验为准，不凭手工复绘猜测分支连接。
5. 任务表达卡模板、指标角色矩阵和区域分层图应与互动页和教师板书保持同一口径，不出现多套术语。

---

## 5. 当前建议补做的媒体

- `4-1-indicator-role-matrix.png`
  - 内容：三类指标分别回答的问题；更适合写成硬约束/软目标/观察指标的典型落点。
- `4-1-task-card-template.png`
  - 内容：对象、目标、硬约束、软目标、观察指标、证据来源六栏模板。
- `4-1-region-layering.png`
  - 内容：`可行域 -> 满意域 -> 最优域` 的三层关系及入口课边界说明。
- `4-1-case-compare-summary.png`
  - 内容：客船航向控制与稳定平台的任务排序差异。

---

## 6. 可选资源

以下文件可继续保留在 `media/raw/` 或后续补充，不作为本轮讲义定稿前置条件：

- `4-1-cover-comic-prompt.md`
- `4-1-intro-video-prompts.md`
- 课堂录音脚本
- 教师版 PDF 导出产物
## 7. 课程导入视频

- 成品：`media/processed/4-1-intro-video.mp4`（已完成）
- 原提示词：`4-1-intro-video-prompts.md` 仍保留为原料。
