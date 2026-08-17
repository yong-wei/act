# 单元 1-1 多媒体规格

## 媒体资源总表

| 资源标识 | 类型 | 文件名 | 生成方式 | 状态 |
|------|------|------|------|:---:|
| h-cover | 封面图 | `1-1-cover-comic.png` | imagen | 已生成 |
| h-info | 信息图 | `1-1-info.png` | imagen | 已生成 |
| h-01 | 方框图（闭环） | `1-1-block-diagram-basic.png` | TikZ 源码 | 已生成 |
| h-02 | 阶跃响应曲线 | `1-1-step-response-first-order.png` / `.pdf` | Octave | 已生成 |
| h-03 | 根轨迹图 | `1-1-root-locus-example.png` / `.pdf` | Octave `rlocus` | 已生成 |
| h-04 | Bode 图 | `1-1-bode-example.png` / `.pdf` | Octave `bode` | 已生成 |
| h-05 | 开环控制结构图 | `1-1-open-loop-block.png` | TikZ 源码 | 已生成 |
| h-06 | 闭环反馈结构图 | `1-1-feedback-loop-block.png` | TikZ 源码 | 已生成 |
| h-07 | 单位负反馈闭环结构图 | `1-1-closed-loop-block.png` | TikZ 源码 | 已生成 |
| h-08 | 一阶比例反馈三域对比 | `1-1-gain-comparison.png` / `.pdf` | Octave | 已生成 |
| h-09 | 示例开环阶跃响应 | `1-1-example-openloop-step.png` / `.pdf` | Octave `step` | 已生成 |
| h-10 | 示例根轨迹 | `1-1-example-root-locus.png` / `.pdf` | Octave `rlocus` | 已生成 |
| h-11 | 示例 Bode 图 | `1-1-example-bode.png` / `.pdf` | Octave `bode` / `margin` | 已生成 |
| h-12 | 示例校正三联图 | `1-1-example-correction-triptych.png` / `.pdf` | Octave | 已生成 |
| c-media | 课程级媒体链接文档 | `1-1-media.md` | 手工维护 | 已生成，课件/课程视频/音频已外链关联，导入视频已落盘 |

## 封面图制作规格

**调用方式**：`.agents/skills/imagen` 技能，文稿定稿后一次性成图。

**提示词存档**：

- `media/raw/1-1-cover-comic.prompt.md`
- `media/processed/1-1-cover-comic.prompt.md`

封面图必须服务开场问题：真实船舶在风浪和扰动中保持航向。图中文字只保留单元标题和开场追问，不把媒体制作说明、路径或生成过程写入学生可见讲义。

## 信息图制作规格

**调用方式**：`.agents/skills/imagen` 技能。

**提示词存档**：

- `media/raw/1-1-info.prompt.md`
- `media/processed/1-1-info.prompt.md`

信息图承担课程收束功能，核心结构为“诊断 → 反馈 → 再诊断”，并围绕时域、根轨迹、频域、反馈取舍四个观察面板组织。

## 代码直出图制作规格

所有 Octave 图由 `media/raw/generate_analysis_figures.m` 生成；Markdown 预览使用 PNG，正式 PDF 导出优先嵌入同名矢量 PDF。单坐标轴图在 PDF 中按 60% 版心嵌入，因此源图字号按出版级缩放要求放大。

### h-02：一阶惯性环节阶跃响应

```octave
K = 1;  tau = 0.5;
G_first = tf(K, [tau 1]);
step(G_first, 4);
```

图中标注时间常数 $\tau=0.5s$，对应讲义图 1-1-2。

### h-03：一阶对象根轨迹

使用 `G_first = 1/(0.5s+1)`，调用 `rlocus(G_first)`，展示比例反馈闭环极点沿实轴左移的直觉，对应讲义图 1-1-3。不要把这张图错写成积分加惯性对象 `1/[s(s+2)]` 的根轨迹。

### h-04：一阶惯性环节 Bode 图

使用 `G_first = 1/(0.5s+1)`，调用 `bode(G_first)`，输出上下二联图，对应讲义图 1-1-4。Bode 图不是单坐标轴图，PDF 中不按 60% 版心压缩。

### h-08：一阶比例反馈三域对比

使用 `G_first = 1/(0.5s+1)` 与 `feedback(2 * G_first, 1)`，输出时域、根轨迹、频域三联图，对应讲义图 1-1-8。该图强调比例反馈会加快响应、移动闭环极点并抬升环路幅频曲线。

### h-09 至 h-12：第六节完整代码示例图

第六节示例统一基于：

```octave
G = tf(1, [1 2 0]);  % G(s)=1/[s(s+2)]
```

- `1-1-example-openloop-step.png`：开环阶跃响应，输出持续增长。
- `1-1-example-root-locus.png`：两条根轨迹分支从 0 和 -2 出发，在 -1 附近会合后离开实轴。
- `1-1-example-bode.png`：积分加惯性对象的 Bode / margin 视角。
- `1-1-example-correction-triptych.png`：校正前后时域、根轨迹、频域三联图，比较 `G` 与 `2G` / `feedback(2G, 1)` 的表现。

## 线框图制作规格

所有线框图均保留 TikZ 源码于 `media/raw/tikz/`，正式 PDF 导出时使用 TikZ 源码嵌入，不使用 raw/tikz 编译出的 PDF 副产物。

### h-01：闭环方框图（问题二用）

五个环节：比较点 → 控制器 → 执行机构 → 被控对象 → 传感器 → 反馈回比较点。传感器位于执行机构正下方，表达完整物理回路语义。

### h-05：开环控制结构图

输入 → 控制动作 → 被控对象 → 输出。无反馈回路；“给定命令”标签必须与信号线保持足够垂直间距，箭头长度不能与标签重叠。

### h-06：闭环反馈结构图

比较点 → 被控对象 → 输出，输出经测量环节返回比较点。此处只突出反馈结构，不引入控制器。

### h-07：单位负反馈闭环结构图

比较点 → 控制器 `C(s)` → 对象 `G(s)` → 输出，反馈通道为 `H(s)=1`，用于引出闭环传递函数 $\Phi(s)$。

## 课程级默认媒体占位

`media/processed/1-1-media.md` 必须保留以下节名：

- 1-1-intro-video.mp4（已完成）
- 1-1-slides.pdf
- 1-1-course.mp4
- 1-1-audio.m4a
- 1-1-handout.md

导入视频成品已落在 `media/processed/1-1-intro-video.mp4`。课件、课程视频与音频若尚未落盘，仍只在媒体链接文档中保留节名；已通过网盘预览地址关联的资源继续写标题与 URL，不得把未落盘资源写成已完成。
