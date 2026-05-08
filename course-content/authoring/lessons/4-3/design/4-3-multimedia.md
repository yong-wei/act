# 单元 4-3 多模态资源设计与采用清单

> **当前阶段目标**：围绕“单结构候选缺口 -> 经典复合控制结构 -> 前馈与反馈分工 -> 实现层保护 -> 客船首轮记录”组织正式媒体，支撑新版讲义中的参考前馈、扰动前馈、给定滤波、限幅、斜率限制和抗积分饱和。
> **命名前缀**：全部统一使用 `4-3-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/pptx/22串联校正/README.md` | `pptx` | 反馈主结构与 Bode 主环路边界 | 改写吸收 | 必融入 | 只保留反馈主结构和裕度分析语言，不沿旧课件重讲整定公式 |
| `course-content/resource-library/pptx/23滞后超前/README.md` | `pptx` | 超前-滞后作为反馈主结构的可调用候选 | 改写吸收 | 必融入 | 只服务客船复合方案的反馈骨架，不扩展成校正理论专题 |
| `course-content/resource-library/ship-control-cases/sections/6.1-船舶航向控制频域校正.md` | `ship-case` | 客船航向保持主案例 | 改写吸收 | 必融入 | 只服务执行器/对象拆分、参考前馈、扰动前馈和首轮验证 |
| `course-content/resource-library/ship-control-cases/sections/6.2-船舶横摇减摇鳍控制系统设计.md` | `ship-case` | 扰动抑制通道重写边界 | 改写吸收 | 可选融入 | 仅作边界提醒，不在本课展开完整横摇控制设计 |
| `course-content/resource-library/pptx/20宽备窄用_稳定裕度/README.md` | `pptx` | Bode 主环路仍需读裕度的说明 | 仅作灵感 | 可选融入 | 保留“反馈主环路仍需稳定裕度”的判断，不重开频域判稳课 |

---

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 用途 |
| :---: | --- | --- | --- | --- |
| 1 | `4-3-cover-comic.png` | 封面图 | 已有 | 导入“从单结构候选进入复合方案” |
| 2 | `4-3-classic-compound-control-structure.png` | 结构图 | 已有 | 展示反馈主结构、参考前馈、扰动前馈、给定滤波和执行器限制的同图关系 |
| 3 | `4-3-disturbance-feedforward-structure.png` | 结构图 | 已有 | 说明扰动在执行器之后、对象之前进入时的前馈补偿位置 |
| 4 | `4-3-disturbance-feedforward-comparison.png` | 对照图 | 已有 | 比较无前馈、75% 前馈和 100% 前馈的扰动抑制差异 |
| 5 | `4-3-reference-feedforward-structure.png` | 结构图 | 已有 | 说明参考前馈与反馈主结构并联进入控制输入 |
| 6 | `4-3-reference-feedforward-comparison.png` | 对照图 | 已有 | 比较参考前馈强度对跟随滞后和舵角峰值的影响 |
| 7 | `4-3-setpoint-filter-structure.png` | 结构图 | 已有 | 展示反馈通道使用 $r_f$、参考前馈仍使用 $r$ 的二自由度关系 |
| 8 | `4-3-setpoint-filter-comparison.png` | 对照图 | 已有 | 说明给定滤波的平顺性收益与速度代价 |
| 9 | `4-3-antiwindup-implementation-structure.png` | 结构图 | 已有 | 展示限幅、斜率限制与反算抗饱和的实现路径 |
| 10 | `4-3-antiwindup-comparison.png` | 对照图 | 已有 | 比较无抗饱和与反算抗饱和的恢复过程 |
| 11 | `4-3-heading-case-quad.png` | 四联图 | 已有 | 保留为反馈主结构与客船案例整体读数参考 |
| 12 | `4-3-info.png` | 信息图 | 已有 | 讲义尾部总收束 |
| 13 | `4-3-media.md` | 媒体索引 | 已有 | runtime / 预习资源统一入口 |

---

## 3. 原始脚本与生成入口

### 3.1 数值数据与图像排版

- **Octave 脚本**：`media/raw/generate_compound_control_case_data.m`
- **Python 排版脚本**：`media/raw/render_compound_control_case_assets.py`
- **用途**：
  - 生成扰动前馈、参考前馈、给定滤波、限幅斜率限制与抗积分饱和相关数据；
  - 生成对应结构图与响应对照图；
  - 保持讲义中的数值表达、图像和首轮记录表一致。

### 3.2 保留媒体

- **封面图**：`media/processed/4-3-cover-comic.png`
- **信息图**：`media/processed/4-3-info.png`
- **导入视频**：`media/processed/4-3-intro-video.mp4`
- **课程视频**：`media/processed/4-3-course.mp4`
- **课件**：`media/processed/4-3-slides.pdf`
- **音频**：`media/processed/4-3-audio.m4a`

---

## 4. 媒体设计约束

1. 正文主图必须服务“通道怎样分工”和“方案怎样运行”，不服务方法百科式罗列。
2. 结构图必须区分反馈主结构、参考前馈、扰动前馈、给定滤波和执行器保护，不能把所有内容塞回单一 `C(s)`。
3. 对照图必须同时说明收益和代价，例如扰动前馈强度、给定滤波速度代价、抗饱和恢复过程。
4. 客船主案例媒体必须能支撑首轮记录表，而不是只展示单条漂亮曲线。
5. 课程级媒体索引继续保留统一 5 个资源节名：`4-3-intro-video.mp4`、`4-3-slides.pdf`、`4-3-course.mp4`、`4-3-audio.m4a`、`handout.md`。

---

## 5. 当前建议补做的媒体

本轮不新增阻断性正式媒体。若后续进入互动课程设计，可优先补两类状态媒体：

- `4-3-compound-plan-record-template.png`：经典复合控制首轮记录表模板；
- `4-3-channel-role-check-template.png`：反馈主结构、参考前馈、扰动前馈和实现保护的通道职责检查模板。

---

## 6. 课程级资源索引对接

- 统一媒体索引文件：`media/processed/4-3-media.md`
- 统一讲义下载源：`design/4-3-handout.pdf`
- runtime 导出继续沿用：
  - `handout.md` 在线阅读；
  - `handout.pdf` 静态下载；
  - `4-3-media.md` 提供课程级资源入口与说明。
