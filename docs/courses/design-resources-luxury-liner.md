# AI-OBE 课程资源详细设计：柔性之海——豪华邮轮的舒适度控制

## 1. 设计概述

本设计文档旨在将《课堂实录设计方案：柔性之海——豪华邮轮的舒适度控制》转化为 AI-OBE 平台可执行的原子化资源配置。

**课程 ID**: `lesson-13-cruise-comfort`
**核心场景**: 豪华邮轮（Luxury Liner）在台风外围海况下的减摇控制。
**对应组件**: `sim-pid-v1` (PID 仿真器), `widget-physics-mech` (物理工坊), `ethics-sandbox` (伦理沙箱)。

---

## 2. 知识图谱拓扑设计 (Knowledge Graph)

需要新增或关联以下知识节点，形成本节课的理论支撑网络。

### 2.1 新增节点定义

| 节点 ID (Key) | 节点名称 | 类型 | 认知维度 | 布鲁姆层级 | 描述 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `node-iso-2631` | ISO 2631 舒适度标准 | THEORY | CONCEPTUAL | UNDERSTAND | 国际标准化组织制定的关于人体承受全身振动评价的标准，特别是晕船指数 (MSI) 的定义。 |
| `node-fin-stabilizer` | 主动减摇鳍 | THEORY | FACTUAL | REMEMBER | 安装在船体两侧的翼状装置，通过改变攻角产生升力，产生抵抗横摇的力矩。 |
| `node-comfort-index` | 舒适度指数 | THEORY | PROCEDURAL | APPLY | 综合考虑加速度、频率和暴露时间的量化指标。 |
| `node-roll-damping` | 横摇阻尼 | THEORY | CONCEPTUAL | ANALYZE | 船舶在横摇运动中受到的阻力矩，直接影响系统的超调量和衰减特性。 |
| `node-trade-off` | 工程折衷 (Trade-off) | ETHICS | METACOGNITIVE | EVALUATE | 在相互冲突的工程目标（如响应速度 vs 舒适度/安全性）之间进行权衡的决策过程。 |

### 2.2 节点关系 (Edges)

*   `node-roll-damping` **influences** `node-comfort-index` (关系: 阻尼影响舒适度)
*   `node-fin-stabilizer` **implements** `node-roll-damping` (关系: 减摇鳍提供阻尼)
*   `node-iso-2631` **defines** `node-comfort-index` (关系: 标准定义指标)
*   `node-trade-off` **governs** `node-fin-stabilizer` (关系: 减摇控制需进行折衷)

---

## 3. 原子化资源配置详情 (Resource Specifications)

所有资源均作为 `TeachingResource` 存入数据库，并通过 `registryId` 关联前端组件。

### 3.1 导入环节 (Bridge-in)

#### 资源 1: 舒适度对比视频 (Video)
*   **ID**: `res-video-comfort-contrast`
*   **Type**: `STATIC_MEDIA` (Video URL)
*   **Content**: `https://assets.ai-obe.com/videos/luxury-vs-speedboat.mp4` (占位符)
*   **Metadata**: `{ "duration": 45, "autoplay": true, "loop": true }`
*   **Description**: 左屏快艇颠簸，右屏邮轮平稳，直观展示控制目标。

#### 资源 2: 舒适度定义投票 (Poll)
*   **ID**: `res-poll-comfort-def`
*   **Type**: `INTERACTIVE_COMP`
*   **Registry ID**: `widget-poll-generic` (需新增或使用通用组件)
*   **Config**:
    ```json
    {
      "question": "你认为衡量豪华邮轮控制好坏的第一标准是什么？",
      "options": [
        { "label": "A. 极限速度", "value": "speed" },
        { "label": "B. 燃油经济性", "value": "eco" },
        { "label": "C. 乘客舒适度 (不晕船)", "value": "comfort" },
        { "label": "D. 准点率", "value": "time" }
      ],
      "correctAnswer": "comfort",
      "chartType": "word_cloud"
    }
    ```

### 3.2 学习目标 (Objective)

#### 资源 3: 任务通关卡 (Knowledge Card)
*   **ID**: `res-card-lesson-obj`
*   **Type**: `STATIC_TEXT` (MDX)
*   **Content**:
    ```markdown
    # 🎯 本课通关任务
    
    1.  **🔓 知识解锁**: 掌握 **阻尼比 $\zeta$** 与 **舒适度 (MSI)** 的定量关系。
    2.  **🛡️ 仿真挑战**: 指挥 "爱达·魔都" 号穿越台风外围，**确保香槟塔不倒**。
    3.  **🏅 徽章获取**: 达成 ISO 2631 标准，获得 **"五星级舒适度工程师"** 认证。
    ```

### 3.3 前测环节 (Pre-assessment)

#### 资源 4: 物理工坊-阻尼初探 (Interactive Widget)
*   **ID**: `res-widget-damping-intro`
*   **Type**: `INTERACTIVE_COMP`
*   **Registry ID**: `widget-physics-mech`
*   **Config**:
    ```json
    {
      "mode": "mechanical",
      "scenario": "mass_spring_damper",
      "title": "调整阻尼器，拯救晕船的小球",
      "instruction": "当前阻尼比 ζ=0.1，震荡剧烈。请拖动滑块增加阻尼，使系统快速平稳且无二次回弹。",
      "initialState": {
        "mass": 10,
        "stiffness": 50,
        "damping": 2  // ζ ≈ 0.04 (Underdamped)
      },
      "targetState": {
        "dampingRange": [12, 18] // Target ζ range 0.6~0.8
      },
      "feedback": {
        "success": "Excellent! 这种阻尼配置最适合人体舒适度。",
        "tooLow": "还是太晃了，乘客会晕船的。",
        "tooHigh": "反应太慢，虽然不晃了，但无法及时复位。"
      }
    }
    ```

### 3.4 参与式学习 - 仿真挑战 (Simulation)

#### 资源 5: 仿真-香槟塔保卫战 (Simulation App)
这是本课的核心资源。

*   **ID**: `res-sim-champagne-defense`
*   **Type**: `SIMULATION_APP`
*   **Registry ID**: `sim-pid-v1`
*   **Config**:
    ```json
    {
      "model": "luxury-liner",
      "modelAsset": "luxury-liner.glb",
      "scenario": "typhoon_avoidance",
      "environment": {
        "seaState": 5,
        "waveHeight": 3.5,
        "windSpeed": 25,
        "waveDirection": 45
      },
      "constraints": {
        "maxRollAngle": 15,
        "maxLateralAccel": 0.2, // g, 伦理熔断阈值
        "comfortThreshold": 0.15 // g, 香槟塔安全阈值
      },
      "initialParams": {
        "kp": 2.0,
        "ki": 0.0,
        "kd": 5.0
      },
      "uiConfig": {
        "showPip": true, // 画中画
        "pipView": "banquet_hall", // 宴会厅视角
        "overlayWarning": "Comfort Index (MSI)",
        "showEthicalMonitor": true
      },
      "objectives": [
        { "type": "maintain_comfort", "target": 0.15, "unit": "g" },
        { "type": "course_change", "target": 30, "unit": "deg", "timeLimit": 60 }
      ]
    }
    ```

#### 资源 6: 响应整形器 (Interactive Widget)
*   **ID**: `res-widget-response-shaping`
*   **Type**: `INTERACTIVE_COMP`
*   **Registry ID**: `widget-argument-principle` (复用现有组件或扩展)
*   **Config**:
    ```json
    {
      "mode": "pole_placement",
      "title": "舒适度安全包络线设计",
      "background": "s_plane_comfort_zone", // 背景显示绿色安全区
      "interactivePoles": true,
      "showStepResponse": true
    }
    ```

### 3.5 伦理熔断逻辑 (Ethical Trigger Logic)

此逻辑嵌入在 `sim-pid-v1` 组件或 `EthicsSandbox` 中。

*   **监测指标**: 侧向加速度 $a_y$ (Lateral Acceleration)。
*   **阈值**: $a_y > 0.2g$ (持续 2秒以上)。
*   **触发行为**:
    1.  **仿真暂停 (Freeze)**: 锁定所有控制输入。
    2.  **UI 变红 (Red Alert)**: 全屏红色遮罩闪烁。
    3.  **弹出模态框 (Modal)**:
        *   **标题**: "⚠️ 严重安全违规 (SOLAS Violation)"
        *   **内容**: "检测到侧向加速度超过 0.2g。该操作极可能导致老年旅客骨折及餐具滑落伤人。违反 ISO 2631 及《国际海上人命安全公约》。"
        *   **整改提问**: "为了抑制高频加速度，在 PD 控制器中，应主要限制哪一项增益？" (选项: P / I / D)。
        *   **正确行为**: 选择 "D (微分项对噪声敏感，过大导致执行器高频抖动)" 或 "P (过大导致超调剧烈)"，视具体仿真物理模型而定（通常高频抖动由 D 引起，剧烈晃动由 P 引起）。在本课境境下，引导学生降低 $K_p$ (减小刚度) 或适当调整 $K_d$ (增加阻尼但避免高频噪)。

### 3.6 后测环节 (Post-assessment)

#### 资源 7: 设计验证 (Quiz/Sim)
*   **ID**: `res-quiz-design-verify`
*   **Type**: `INTERACTIVE_COMP`
*   **Registry ID**: `quiz-design-verify`
*   **Config**:
    ```json
    {
      "mode": "simulation_submit",
      "title": "提交你的最终设计方案",
      "fields": [
        { "name": "kp", "label": "比例增益 Kp", "type": "number" },
        { "name": "kd", "label": "微分增益 Kd", "type": "number" }
      ],
      "runSimulation": true, // 后台运行快速仿真验证
      "scoringFormula": "100 / (1 + MSI) - (violationCount * 10)",
      "passingScore": 80
    }
    ```

### 3.7 总结 (Summary)

#### 资源 8: 动态课堂报告 (AI Report)
*   **ID**: `res-ai-report-summary`
*   **Type**: `INTERACTIVE_COMP`
*   **Registry ID**: `widget-class-report`
*   **Config**:
    ```json
    {
      "metrics": ["comfort_index", "settling_time", "ethical_violations"],
      "chartType": "scatter_plot",
      "xAxis": "settling_time",
      "yAxis": "comfort_index",
      "aiNarration": "analyze_class_performance"
    }
    ```

---

## 4. 实施建议

1.  **组件扩展**: 现有的 `sim-pid-v1` 需要支持 `uiConfig.showPip` (画中画) 模式，用于显示香槟塔的简易物理模型（倒立摆）。
2.  **数据埋点**: 在 `InteractionLog` 中记录 `max_lateral_accel` 和 `champagne_fallen` (Boolean) 状态。
3.  **AI Persona**: 确保 AI 助手的 Prompt 中包含 "Service Director" 的角色设定，在学生操作时给出 "请注意，3号桌的客人看起来有些不适" 等软性提示。