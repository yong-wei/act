# 单元 L-2c 多模态资源设计文档

**单元**：L-2c 频域直觉速通——Bode图与相位裕度初识
**生成日期**：2026-03-13
**资源总数**：6项（代码直出图×5 + AI生成位图×1）

---

## 资源总表

| # | 用途 | 文件名（无后缀） | 生成方式 | 引用位置 | 优先级 |
|---|------|-----------------|----------|----------|--------|
| 01 | `h` | h-01-bode-magnitude-regions | 代码直出（Python/matplotlib） | handout §2.1 / ic step-05 | **P1** |
| 02 | `h` | h-02-phase-margin-diagram | 代码直出（Python/matplotlib） | handout §2.3 / ic step-09 | **P1** |
| 03 | `h` | h-03-bode-example-annotated | 代码直出（Python/matplotlib） | handout §三（例题） / ic step-15 | **P1** |
| 04 | `sh` | sh-04-phase-margin-vs-overshoot | 代码直出（Python/matplotlib） | handout §2.4 / ic step-13 | **P1** |
| 05 | `sh` | sh-05-three-domain-coupling | 代码直出（Python/matplotlib） | handout §2.5 / ic step-14 | **P1** |
| 06 | `sh` | sh-00-equalizer-analogy | AI生成位图（PNG） | ic step-02（导入类比图） | P2 |

---

## 各资源制作规格

---

### 01 · h-01-bode-magnitude-regions（已完成）

**文件**：`media/raw/h-01-bode-magnitude-regions.py` → `media/processed/h-01-bode-magnitude-regions.svg`

**内容描述**：
典型二阶系统（ζ=0.45, ωn=0.05 rad/s）闭环幅频曲线，标注三区域结构与截止频率 ωc。

**视觉规格**：
- 画布：8×5 in，深色背景 `#0f172a`
- 幅频曲线：青色 `#67e8f9`，linewidth=2.2
- 三区域色块：通过区（绿 `#22c55e` α=0.08）/ 过渡区（黄 `#eab308`）/ 衰减区（红 `#ef4444`）
- ωc 竖线+点标注：琥珀色 `#f59e0b`
- 0dB 参考线：灰色虚线
- 区域文字：通过区/过渡区/衰减区

**对应讲义位置**：`handout.md` §2.1（图占位符 `![图1 Bode幅频三区域结构](../media/processed/h-01-bode-magnitude-regions.svg)`）

---

### 02 · h-02-phase-margin-diagram（已完成）

**文件**：`media/raw/h-02-phase-margin-diagram.py` → `media/processed/h-02-phase-margin-diagram.svg`

**内容描述**：
双面板 Bode 图（幅频+相频），标注截止频率 ωc 和相位裕度 γ 双向箭头，-180° 危险边界红线。

**视觉规格**：
- 画布：8×7 in，双子图，深色背景
- 典型二阶系统：ζ=0.45, ωn=0.05
- 上图（幅频）：青色曲线，琥珀色 ωc 标注点
- 下图（相频）：紫色曲线 `#a78bfa`，红色 -180° 线，青色双向箭头标注 γ

**对应讲义位置**：`handout.md` §2.3（图占位符 `![图3 相位裕度示意图](../media/processed/h-02-phase-margin-diagram.svg)`）

---

### 03 · h-03-bode-example-annotated（已完成）

**文件**：`media/raw/h-03-bode-example-annotated.py` → `media/processed/h-03-bode-example-annotated.svg`

**内容描述**：
例题用 Bode 图，开环 G(s)=K/(s(τs+1))，K=0.0025, τ=10，标注读图三步骤①②③。
- ①：幅频穿越0dB，ωc≈0.05 rad/s
- ②：相频处相角 ≈ -135°
- ③：γ = 180° + (-135°) = 45°，双向箭头标注

**视觉规格**：
- 画布：8×7 in，双子图
- 上图：幅频曲线+0dB+ωc竖线，标注①文本框
- 下图：相频曲线+-180°红线+ωc竖线，标注②③双向箭头

**对应讲义位置**：`handout.md` §三（例题图）

---

### 04 · sh-04-phase-margin-vs-overshoot（已完成）

**文件**：`media/raw/sh-04-phase-margin-vs-overshoot.py` → `media/processed/sh-04-phase-margin-vs-overshoot.svg`

**内容描述**：
相位裕度 γ 与超调量 Mp 的关系图，含：
- 精确二阶系统曲线（青色）
- γ≈100ζ° 近似曲线（紫色虚线）
- 三个工程参考点：γ=30°(Mp≈37%)、γ=45°(Mp≈20%)、γ=60°(Mp≈9%)
- 工程良好范围 30°~60° 绿色背景色块

**视觉规格**：
- 画布：8×5 in，x轴 γ(°)，y轴 Mp(%)
- 参考点颜色：红/琥珀/绿对应30/45/60度

**对应讲义位置**：`handout.md` §2.4（图占位符）
**对应互动页面位置**：`interactive-page.md` step-13

---

### 05 · sh-05-three-domain-coupling（已完成）

**文件**：`media/raw/sh-05-three-domain-coupling.py` → `media/processed/sh-05-three-domain-coupling.svg`

**内容描述**：
三域直觉联动全景图，三角形结构：
- 顶点（极点位置 s平面）/ 左下（时域响应 Mp）/ 右下（频域特性 γ）
- 三条带双向箭头的连线，标注跨域关系公式
- 中心：ζ 圆圈 + "阻尼比 ζ 是三域桥梁" 标注
- 工程典型值对照表（ζ=0.3/0.45/0.6）

**视觉规格**：
- 画布：9×7 in，无坐标轴
- 节点配色：蓝（极点）/ 绿（时域）/ 紫（频域）
- 连线：琥珀（ζ→Mp）/ 青（ζ→γ）/ 粉（γ↔Mp）
- 中心圆：黄色边框 `#fde047`

**对应讲义位置**：`handout.md` §2.5（图占位符）
**对应互动页面位置**：`interactive-page.md` step-14

---

### 06 · sh-00-equalizer-analogy（待生成）

**文件**：`media/raw/sh-00-equalizer-analogy.png` → `media/processed/sh-00-equalizer-analogy.png`

**用途**：互动课 step-02 导入类比图，呼应"每种节拍的信号"直觉类比。

**场景描述**：
音乐均衡器（EQ）的旋钮界面，显示多个频段滑块（低频/中频/高频），背景是录音棚或数字音乐工作站风格。画面传达"不同频率，不同响应"的直觉。画风偏科技感/现代感，颜色深色为主，带科技蓝。

**英文生图提示词（Midjourney / DALL·E 格式）**：
```
A high-tech audio equalizer interface with multiple frequency band sliders showing a curve,
set in a dark modern music production studio.
Low frequencies on the left, high frequencies on the right,
with glowing blue and cyan accents on the sliders.
The display shows a smooth frequency response curve with peaks and valleys.
Dark background (#0f172a equivalent), clean flat design,
slight digital glow effect on the EQ curve.
No text or labels. Aspect ratio 16:9.
```

**备注**：
- 推荐尺寸：1280×720 px（16:9）
- 不需要 CJK 文字，纯图形
- 如使用 Midjourney，追加参数：`--ar 16:9 --style raw --v 6`

**对应互动页面位置**：`interactive-page.md` step-02（图占位符 `sh-00-equalizer-analogy`）

---

## 执行清单

```bash
# 进入 raw 目录执行代码直出图
cd authoring/lessons/legacy/L-2c/media/raw

python3 h-01-bode-magnitude-regions.py --output ../processed/h-01-bode-magnitude-regions.svg
python3 h-02-phase-margin-diagram.py   --output ../processed/h-02-phase-margin-diagram.svg
python3 h-03-bode-example-annotated.py --output ../processed/h-03-bode-example-annotated.svg
python3 sh-04-phase-margin-vs-overshoot.py --output ../processed/sh-04-phase-margin-vs-overshoot.svg
python3 sh-05-three-domain-coupling.py --output ../processed/sh-05-three-domain-coupling.svg
```

AI 生图（sh-00）使用上方英文提示词，生成后放入 `media/raw/` 并压缩版本放入 `media/processed/`。

---

## 引用回写记录

| 文件 | 插入位置 | 引用路径 | 状态 |
|------|----------|----------|------|
| `handout.md` | §2.1 三区域结构说明后 | `h-01-bode-magnitude-regions.svg` | ✅ 已回写 |
| `handout.md` | §2.3 工程经验值表格后 | `h-02-phase-margin-diagram.svg` | ✅ 已回写 |
| `handout.md` | §2.4 γ-Mp关系图后 | `sh-04-phase-margin-vs-overshoot.svg` | ✅ 已回写 |
| `handout.md` | §2.5 三域联动全景图后 | `sh-05-three-domain-coupling.svg` | ✅ 已回写 |
| `handout.md` | §三 例题题目与解题之间 | `h-03-bode-example-annotated.svg` | ✅ 已回写 |
| `interactive-page.md` | step-02 场景卡片 | `sh-00-equalizer-analogy.png` | ⬜ 待AI生图后回写 |
| `interactive-page.md` | step-05 [揭示2] | `h-01-bode-magnitude-regions.svg` | ✅ 已回写 |
| `interactive-page.md` | step-09 [揭示2] 后 | `h-02-phase-margin-diagram.svg` | ✅ 已回写 |
| `interactive-page.md` | step-13 [揭示3] 后 | `sh-04-phase-margin-vs-overshoot.svg` | ✅ 已回写 |
| `interactive-page.md` | step-14 全景图 | `sh-05-three-domain-coupling.svg` | ✅ 已回写 |
| `interactive-page.md` | step-15 例题图 | `h-03-bode-example-annotated.svg` | ✅ 已回写 |
