# Control Odyssey (控制奥德赛) - 游戏化控制理论学习设计方案

## 1. 项目概述

**Control Odyssey** 是一款基于 Web 的横版卷轴通关游戏，旨在通过游戏化手段让学生直观体验控制系统的动态特性、时域指标及控制器参数整定的影响。

核心隐喻是将“被控对象”具象化为一艘在复杂水道（误差带）中航行的船舶/潜艇，玩家的目标是通过控制或整定参数，使船舶在不触碰边界（障碍物）的前提下，尽可能快且稳地通过关卡。

---

## 2. 游戏机制 (Gameplay Mechanics)

### 2.1 核心玩法循环
游戏界面类似 "Flappy Bird" 或 "Jetpack Joyride"，但在物理引擎层面完全遵循控制理论微分方程。

1.  **输入端**：
    *   **手动模式 (Manual Loop)**：玩家按下键盘 $\uparrow$ / $\downarrow$，直接改变控制量 $u(t)$（如舵角、油门）。此时玩家的大脑就是控制器。
    *   **自动/辅助模式 (Auto/Supervisor Loop)**：解锁控制器后，玩家按下 $\uparrow$ / $\downarrow$ 改变的是**设定值 (Setpoint/Reference) $r(t)$**（即船舶想要去的高度）。底层的 PID 控制器根据玩家配置的参数计算 $u(t)$ 驱动船舶。如果参数没调好，船舶会震荡、超调从而撞墙。

2.  **被控对象 (Plant)**：
    *   角色位置 $y(t)$ 由系统传递函数 $G(s)$ 决定。
    *   **第一关**：比例环节（无惯性，按多少走多少）。
    *   **后续关卡**：一阶惯性环节（有延迟）、二阶振荡环节（有弹簧阻尼效应，操作过猛会刹不住车）、非线性环节（死区、饱和）。

3.  **障碍与通道 (Constraints)**：
    *   屏幕中间生成不规则的“安全通道”。
    *   通道的中心线即为**理想期望轨迹**。
    *   通道的上下边缘代表**最大允许误差带**。
    *   触碰边缘即判定为“系统失稳”或“超出安全限制”，游戏失败。

### 2.2 评分与结算系统 (Scoring & Metrics)
通关不仅仅是活下来，还要活得“漂亮”。结算界面将展示：

*   **综合得分**：$S = W_1  (1 - \text{IAE}) + W_2  T_{settling} + W_3  \text{SurvivalTime}$
*   **时域指标卡片**：
    *   **超调量 (Overshoot $\sigma\%$)**：最大偏离期望值的百分比。
    *   **调节时间 (Settling Time $t_s$)**：进入并保持在 $\pm 5\%$ 误差带所需时间。
    *   **积分误差 (ISE/IAE)**：全程轨迹与中心线的偏差累积。
*   **评级**：S (专家级), A, B, C, F (失稳)。

### 2.3 排行榜 (Leaderboard)
*   **全球总榜**：基于所有关卡总分。
*   **关卡分榜**：点击某个排名，可查看该玩家通关时的**核心指标雷达图**（如：该玩家超调极小，但调节时间较长，说明他是保守型选手）。

---

## 3. 进阶功能与解锁系统 (Progression)

使用通关获得的“控制积分 (Control Credits)”进行兑换。

### 3.1 控制器商店
*   **纯比例控制 (P)**：解锁后可调节 $K_p$。感受静差。
*   **比例微分 (PD)**：解锁 $K_d$。感受阻尼增加，超调减小。
*   **比例积分 (PI)**：解锁 $K_i$。消除静差，但可能引入震荡。
*   **PID 全开**：完全体。
*   **测速反馈**：高级道具，增加系统阻尼。
*   **入口**：关卡选择页提供“控制商店”按钮，换购后在关卡配置页可选。

### 3.2 控制器配置窗口 (Tuning Lab)
*   **交互**：点击已解锁的控制器图标，弹出悬浮窗。
*   **框图可视化**：显示当前闭环系统的动态框图。
*   **参数整定**：拖动滑块或输入数值修改 $K_p, K_i, K_d$。
*   **记忆功能**：系统自动保存玩家在当前关卡偏好的参数配置（存入数据库）。

### 3.3 视觉化增强
*   **实时曲线 (Real-time Scope)**：屏幕底部滚动显示 $r(t)$ (期望), $y(t)$ (实际), $u(t)$ (控制力) 三条曲线。
*   **幽灵船 (Ghost Ship)**：重玩关卡时，显示自己最高分的录像，或显示“理论最优控制”的半透明影子，引导玩家操作。

---

## 4. 增强教育性的设计细节

### 4.1 干扰引入 (Disturbances)
*   在高级关卡中引入**风浪 ($d(t)$)**。
*   表现为突加的阶跃干扰或正弦波干扰。
*   考察系统在有干扰情况下的稳态误差消除能力（引导学生通过积分作用消除干扰）。

### 4.2 AI 首席轮机长 (Virtual Chief Engineer)
*   **失败反馈**：当玩家撞墙失败时，AI 根据数据给出建议。
    *   *例*：“你刚才撞到了上边缘，说明超调量太大了。试着增加一点微分增益 ($K_d$) 来增加阻尼，或者减小比例增益 ($K_p$)。”
*   **实时吐槽**：如果系统震荡剧烈，AI 会在侧边栏弹出警告气泡：“船身晃动太厉害了，旅客在投诉！稳住！”

---

## 5. 技术架构方案

### 5.1 前端实现
*   **渲染引擎**：Canvas API 或 React Three Fiber (为了与现有3D资产统一，建议使用 R3F 做背景，Canvas 做前景游戏逻辑，或纯 Canvas 2D 以保证性能)。
*   **物理/数学引擎**：扩展 `src/lib/simulation-engine.ts`。
    *   实现 Runge-Kutta (RK4) 求解器，支持实时步进。
    *   定义通用的 `TransferFunction` 类。
*   **状态管理**：Zustand (`useGameStore`) 管理分数、生命值、当前控制器参数。
*   **UI 组件**：Shadcn/ui 用于配置弹窗、排行榜和结算面板。

### 5.2 数据库 Schema (Prisma)

```prisma
// 新增模型

model GameLevel {
  id          String   @id @default(cuid())
  name        String
  difficulty  Int
  config      String   // JSON: 传递函数参数, 障碍物生成种子
  scores      GameScore[]
}

model GameScore {
  id          String   @id @default(cuid())
  userId      String
  levelId     String
  score       Float
  metrics     String   // JSON: { overshoot, riseTime, etc. }
  tuning      String   // JSON: { Kp, Ki, Kd } (记录通关时的参数)
  createdAt   DateTime @default(now())
  
  user        User      @relation(fields: [userId], references: [id])
  level       GameLevel @relation(fields: [levelId], references: [id])
}

model UserUnlock {
  id          String   @id @default(cuid())
  userId      String
  itemType    String   // "CONTROLLER_PD", "CONTROLLER_PID", "MODE_AUTO"
  unlockedAt  DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
}
```

> 说明：当前阶段将控制积分与解锁状态存放于用户画像（Profile）字段，待数据稳定后再考虑拆分独立表。

### 5.3 目录结构规划
由于该游戏归属于互动学习模块，核心逻辑与组件将位于 `src/resources/interactive-learning/` 下，页面路由则位于 `src/app/`。

```
src/
  app/
    (main)/
      interactive-learning/
        control-odyssey/       # 页面路由入口
          page.tsx             # 页面外壳，引入核心组件
  resources/
    interactive-learning/
      control-odyssey/         # 游戏核心代码 (Feature Module)
        index.tsx              # 统一导出入口
        components/
          GameCanvas.tsx       # 游戏渲染画布
          LevelSelector.tsx    # 关卡选择与榜单
          TelemetryScope.tsx   # 实时曲线
          TuningPanel.tsx      # 控制器参数面板
        engine/
          physics.ts           # 核心物理引擎 (Euler)
          level-generator.ts   # 关卡与障碍生成
        store/
          game-store.ts        # Zustand 状态管理
        assets/                # 游戏专属静态资源
```

---

## 6. 当前实现状态与差距

### 已实现
*   **核心玩法**：Canvas 2D + RAF 游戏循环、基础碰撞检测、飞船固定视角滚动。
*   **控制模式**：手动模式与 PID 辅助模式；配置页选择控制模式，进入游戏后不再显示参数面板。
*   **关卡机制**：Level 1/2/3（比例/惯性/惯性+正弦干扰），含起步安全区与终点安全区。
*   **UI 与遥测**：关卡选择、模式配置、实时曲线 (R/Y/U)、结算面板与排行榜。
*   **数据接入**：成绩写入 `SimulationLog`，排行榜按最高分展示。

### 待完善
*   **高阶模型**：RK4 求解器与通用传递函数框架尚未接入，二阶振荡/非线性关卡待补全。
*   **进阶系统**：控制器商店、解锁逻辑、幽灵船、AI 反馈未实现。
*   **数据模型**：尚未拆分独立的 GameLevel/GameScore 结构。

---

## 7. 关卡与控制商店设计方案（已确认方向）

### 7.1 关卡分级机制
每个关卡包含 **青铜 / 白银 / 黄金** 三个等级，差异体现在给定信号与扰动：
*   **青铜**：跟踪单一阶跃信号。
*   **白银**：跟踪多个阶跃信号组合（不同时间、不同高度），组合进入关卡时即时随机生成（不固定 seed）。
*   **黄金**：在跟踪阶跃/组合的同时，叠加输出端扰动；画面表现为“暗流/空间乱流”区域（垂直向上或向下），扰动为输出端阶跃叠加。
*   **解锁规则**：每个关卡内，青铜通关后解锁白银，白银通关后解锁黄金。

### 7.2 控制对象谱系（从简单到复杂）
建议按以下序列逐步引入对象复杂度：
1.  纯比例环节（P）
2.  纯积分环节（I）
3.  小惯性环节（小 T）
4.  大惯性环节（大 T）
5.  小惯性 + 纯延时（小 T + 小 L）
6.  大惯性 + 纯延时（大 T + 小 L）
7.  大惯性 + 大延时（大 T + 大 L）
8.  欠阻尼二阶系统（ζ = 0.9 / 0.707 / 0.5 / 0.2）
9.  无阻尼二阶系统（ζ = 0）
10. 高阶系统（3~4 阶，含多个极点）

**参数建议（可在关卡配置内覆盖）**：
*   **P**：`G(s)=K`，默认 `K=1`（TF: `num=[1]`, `den=[1]`）
*   **I**：`G(s)=1/s`（TF: `num=[1]`, `den=[1,0]`）
*   **小惯性**：`G(s)=1/(0.5s+1)`（TF: `den=[0.5,1]`）
*   **大惯性**：`G(s)=1/(2s+1)`（TF: `den=[2,1]`）
*   **小惯性+小延时**：`G(s)=1/(0.5s+1)·e^{-Ls}`，默认 `L=0.2s`
*   **大惯性+小延时**：`G(s)=1/(2s+1)·e^{-Ls}`，默认 `L=0.2s`
*   **大惯性+大延时**：`G(s)=1/(2s+1)·e^{-Ls}`，默认 `L=0.8s`
*   **欠阻尼二阶**：标准二阶 `G(s)=ω_n^2/(s^2+2ζω_n s+ω_n^2)`，默认 `ω_n=1`，`ζ ∈ {0.9,0.707,0.5,0.2}`
*   **无阻尼二阶**：`ζ=0`
*   **高阶系统**：可采用多个一阶惯性串联（例如 `1/((0.5s+1)(2s+1))`）或 ZPK 形式配置

### 7.3 关卡配置结构（level-data）
关卡配置文件需同时描述模型、给定信号、扰动与仿真时长（默认 3000m），并保留扩展常见信号：

```ts
type SignalType = 'step' | 'sequence' | 'ramp' | 'accel' | 'custom';
type DisturbanceType = 'none' | 'output-step';
type ModelForm = 'tf' | 'zpk';

interface SignalEvent {
  at: number;        // 触发位置（m），统一以关卡距离为基准
  amplitude: number; // 幅值
}

interface ReferenceSignalConfig {
  type: SignalType;
  events: SignalEvent[]; // step/sequence
  seed?: number;         // 可选：用于调试或复刻的固定 seed
  rampRate?: number;     // ramp
  accelRate?: number;    // accel
}

interface DisturbanceEvent {
  at: number;
  amplitude: number;
  duration?: number; // 可选：用于可视化暗流区域长度
}

interface DisturbanceConfig {
  type: DisturbanceType;
  events: DisturbanceEvent[];
  visual?: {
    style: 'turbulence' | 'dark-current';
    direction?: 'up' | 'down';
    intensity?: 'low' | 'mid' | 'high';
  };
}

interface ModelConfigTF {
  form: 'tf';
  numerator: number[];
  denominator: number[];
  delay?: number; // 纯延时 L（秒），显式延迟队列实现
}

interface ModelConfigZPK {
  form: 'zpk';
  zeros: number[];
  poles: number[];
  gain: number;
  delay?: number;
}

interface LevelTierConfig {
  tier: 'bronze' | 'silver' | 'gold';
  distance: number; // 默认 3000m
  reference: ReferenceSignalConfig;
  disturbance: DisturbanceConfig;
  envelope: {
    margin: number; // 通道围绕给定信号的包络宽度
  };
}

interface ControlOdysseyLevelConfig {
  id: string;
  name: string;
  difficulty: number;
  model: ModelConfigTF | ModelConfigZPK;
  tiers: LevelTierConfig[];
}

interface ControlOdysseyConfig {
  levels: ControlOdysseyLevelConfig[];
  shop: ShopConfig;
}
```

**通道生成**：以给定信号为中心线，按 `envelope.margin` 自动扩展形成通道；若有扰动，视觉上标注暗流区域（上下箭头/粒子流向）。

**等级模板建议（用于 level-data 生成规则）**：
*   **青铜**：单一阶跃，`events=[{at: 300, amplitude: 0.4}]`，`margin=0.6`
*   **白银**：3~5 个阶跃组合，`at` 在 `[300, distance-400]` 内随机，最小间隔 `>= 250m`，`amplitude` 在 `[-0.5, 0.6]` 区间随机，`margin=0.55`
*   **黄金**：同白银阶跃组合 + 2~3 个输出端扰动，`amplitude` 在 `[-0.25, 0.25]`，`duration` 120~220m；视觉采用 `dark-current` + `direction`（与扰动符号一致），`margin=0.5`

**信号扩展**：支持 `ramp`/`accel` 等常见信号，后续可在 `custom` 中接入多项式或分段函数。

### 7.4 控制商店（积分换购）
*   **积分来源**：控制积分 = `floor(Score / 150)` + 等级加成（青铜 +0、白银 +20、黄金 +40）。
*   **控制器类型**：P / PI / PD / PID / 纯前馈 / 迟滞补偿（待定）。
*   **换购规则**：控制器需消耗积分解锁；解锁后在关卡配置页可选用。
*   **价格体系**：在 `level-data.ts` 中提供可扩展价格配置（与关卡配置同源），例如：

```ts
interface ShopItem {
  id: string;
  label: string;
  price: number;
  unlocks: { controller: string };
  requires?: string[]; // 先决控制器
}

interface ShopConfig {
  currency: 'credits';
  items: ShopItem[];
}
```

**价格建议（可配置）**：
*   **P**：免费（默认解锁）
*   **PI**：1200
*   **PD**：1200
*   **PID**：2600（requires: PI + PD）
*   **前馈/补偿类**：后续按课程进度定价（例如 600+）

---

### 7.5 已确认事项（开发基线）
*   **积分来源**：结算得分 = 控制积分，直接累计，无首通奖励。
*   **存储位置**：积分与解锁信息存放于用户画像（Profile）字段。
*   **白银随机性**：每次进入关卡即时随机生成阶跃组合，不固定 seed。
*   **纯延时实现**：采用显式延迟队列。

---

## 8. 开发路线图 (更新)

1.  **Phase 1: 原型 (Prototype) - 已完成**
    *   实现纯 Canvas 的滚动背景与基础碰撞检测。
    *   实现手动模式的控制量输入与飞船运动模型。
2.  **Phase 2: 控制器接入 - 已完成**
    *   实现 PID 算法与“辅助模式”(按键改变设定值)。
    *   底部实时曲线绘制 (Canvas)。
3.  **Phase 3: 关卡与积分 - 部分完成**
    *   设计 3 个基础关卡（比例/惯性/惯性+干扰），二阶/非线性关卡待补齐。
    *   已接入结算与排行榜（`SimulationLog`），仍需完善数据模型与指标体系。
4.  **Phase 4: UI 与 商店 - 部分完成**
    *   排行榜页面已完成。
    *   控制器解锁逻辑、AI 提示集成待完成。

---

## 9. 实施日志 (Implementation Log)

### 2026-01-08: Phase 1 - 初始化与原型
*   **目录结构**：按照 Interactive Learning 规范创建了 `src/resources/interactive-learning/control-odyssey`。
*   **核心组件**：
    *   `GameCanvas.tsx`: 实现了基础的 React + Canvas 渲染循环。
    *   `game-store.ts`: 使用 Zustand 建立了游戏状态管理。
    *   `index.tsx`: 组装了游戏主界面，包含 Canvas 和 控制面板占位符。
*   **系统集成**：
    *   在 `src/lib/resource-registry.tsx` 中注册为 `control-odyssey-v1`。
    *   执行了 `scripts/seed-interactive-resources.ts`，将游戏添加到数据库的 `FUN_EXPLORATION` 分类中。
    *   创建了独立访问路由 `src/app/interactive-learning/control-odyssey/page.tsx`。

### 2026-01-08: UI 与流程修正
*   **关卡选择**：点击仅选中关卡，底部按钮进入配置页，榜单随关卡更新。
*   **配置与面板**：配置页集中完成控制器设置，游戏内不再显示参数面板。
*   **结算与榜单**：避免重复提交，榜单按账号最高分展示。
*   **关卡体验**：终点线触发即刻结算，终点后通道设为可行空间。
*   **遥测曲线**：曲线展示全航程全景。

---
*Created by Project Architect on 2026-01-08*
