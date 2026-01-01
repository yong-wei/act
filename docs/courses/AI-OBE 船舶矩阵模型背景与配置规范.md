# AI-OBE 船舶矩阵模型背景与配置规范

## 一、 矩阵设计逻辑 (The Matrix Logic)

本平台采用 **"1 (旗舰) + N (舰队) + X (原子)"** 的三层模型体系：

1. **旗舰模型 (The Flagship)**: **055型万吨驱逐舰**。全参数、高保真、多自由度耦合。用于课堂主线教学。
2. **舰队模型 (The Fleet)**: **5种特种船舶**。在特定物理参数（如大滞后、变质量）上具有显著特征。用于课后迁移与鲁棒性对抗。
3. **原子模型 (The Atoms)**: **3种轻量级组件**。数学本质是倒立摆、RLC、水箱，但被“工程化”包装。用于特定章节（如微分方程、频率响应）的概念引入。

------

## 二、 X：原子模型 (Lightweight Atoms) —— 概念引入层

**设计意图**：将抽象的经典教具赋予“舰船”的物理外壳，降低认知门槛，保持情境连贯。

### 1. 舰载雷达稳定平台 (Shipborne Radar Stabilization)

- **数学原型**：**倒立摆 (Inverted Pendulum)**

- **对应原型**：055大驱上的“海之星”有源相控阵雷达底座或舰载卫星天线。

- **教学用途**：

  - **Ch1 概论**：开环必倒，闭环才能稳（反馈的作用）。
  - **Ch3 稳定性**：右半平面极点（RHP Pole）意味着什么？

- **Profile 配置**：

  JSON

  ```
  {
    "id": "atom-radar-stabilizer",
    "name": "舰载雷达稳定平台",
    "type": "atomic",
    "prototype": "Shipborne Active Phased Array Radar Base",
    "visualAsset": "assets/models/radar_base.glb",
    "dynamics": {
      "modelType": "transfer_function",
      "equation": "G(s) = K / (s^2 - g/l)", // 典型的开环不稳定系统
      "parameters": {
        "l": 0.5, // 重心高度
        "g": 9.8
      }
    },
    "challenge": "系统天生不稳定，必须设计闭环控制使其直立。",
    "ethicalContext": null // 原子模型通常不涉及复杂伦理
  }
  ```

### 2. 船舶被动减摇水舱 (Passive Anti-Roll Tank)

- **数学原型**：**U型管液位系统 (U-Tube Manometer / Mass-Spring-Damper)**

- **对应原型**：“爱达·魔都”号上的U型减摇水舱。

- **教学用途**：

  - **Ch2 建模**：典型的二阶系统（惯性+阻尼+恢复力）。
  - **Ch5 频域**：共振峰的概念。如何设计水舱的固有频率使其与船体横摇频率“共振”以吸收能量（动力吸振器原理）。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "atom-antiroll-tank",
    "name": "U型减摇水舱",
    "type": "atomic",
    "prototype": "U-Tube Passive Anti-Roll Tank",
    "visualAsset": "assets/models/u_tank.glb",
    "dynamics": {
      "modelType": "differential_equation",
      "equation": "J*y'' + B*y' + K*y = M_roll", // 标准二阶震荡
      "parameters": {
        "dampingRatio": 0.1, // 欠阻尼，震荡剧烈
        "naturalFreq": 0.8
      }
    },
    "challenge": "调整阀门开度（改变阻尼 B），使水舱内的液体流动能最快平稳。",
    "ethicalContext": null
  }
  ```

### 3. 电力推进滤波回路 (Electric Propulsion Filter)

- **数学原型**：**RLC 电路 (RLC Circuit)**

- **对应原型**：福建舰电磁弹射储能系统 或 055 全电推进系统的直流母线滤波。

- **教学用途**：

  - **Ch2 建模**：机电相似性（电感=质量，电容=弹簧）。
  - **Ch5 频域**：宽频带响应，噪声滤除。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "atom-propulsion-filter",
    "name": "全电推进滤波回路",
    "type": "atomic",
    "prototype": "DC Bus Filter for IEP System",
    "visualAsset": "assets/models/circuit_board.glb",
    "dynamics": {
      "modelType": "transfer_function",
      "equation": "G(s) = 1 / (L*C*s^2 + R*C*s + 1)",
      "parameters": {
        "L": 0.01,
        "C": 0.005,
        "R": 2.0
      }
    },
    "challenge": "设计参数以滤除发电机产生的高频谐波噪声。",
    "ethicalContext": null
  }
  ```

------

## 三、 N：舰队模型 (The Fleet) —— 迁移与对抗层

**设计意图**：在055旗舰教学之后，通过这些变式模型，考察学生对**“参数摄动”、“非线性”、“大滞后”**等复杂特性的应对能力。

### 1. “天鲸号”自航绞吸挖泥船 (Dredger)

- **工程特性**：**定位精度极高 + 强负载扰动**。

- **控制难点**：绞刀切入岩石时，船体会受到巨大的、突变的后坐力。需要高刚度的控制系统。

- **知识点映射**：**稳态误差 (Ch3)**，**前馈控制 (Ch6)**。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "fleet-dredger-tianjing",
    "name": "天鲸号挖泥船",
    "type": "fleet",
    "visualAsset": "assets/ships/tianjing.glb",
    "dynamics": {
      "baseModel": "Nomoto1stOrder",
      "modifications": {
        "massMultiplier": 5.0, // 质量极大
        "disturbancePattern": "step_impulse_mixed" // 模拟挖掘时的撞击
      }
    },
    "challenges": [
      "在强海流和挖掘反力下，保持船位误差 < 0.1m",
      "设计高增益积分器消除静差"
    ],
    "ethicalContext": {
      "dilemma": "吹填造岛效率 vs 生态保护",
      "rules": ["禁止在珊瑚礁保护区作业", "泥浆浊度超标需停工"]
    }
  }
  ```

### 2. “长恒系列”大型 LNG 运输船 (LNG Carrier)

- **工程特性**：**大纯滞后 + 液体晃荡**。

- **控制难点**：巨大的船体和液货惯性导致控制指令发出后，船体要过几十秒才有反应（大 $\tau$）。且液货晃荡会产生额外的力矩。

- **知识点映射**：**滞后系统 (Ch5)**，**Smith预估器 (Ch6)**，**稳定裕度**。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "fleet-lng-changheng",
    "name": "长恒系列 LNG 船",
    "type": "fleet",
    "visualAsset": "assets/ships/lng_changheng.glb",
    "dynamics": {
      "baseModel": "Nomoto2ndOrder",
      "modifications": {
        "timeDelay": 25.0, // 25秒纯滞后！
        "sloshingEffect": true // 开启液货晃荡干扰
      }
    },
    "challenges": [
      "克服25秒纯滞后带来的相位损失",
      "防止液货剧烈晃荡引发共振"
    ],
    "ethicalContext": {
      "dilemma": "经济航速 vs 泄漏风险",
      "rules": ["急转弯导致液货压力报警时必须熔断"]
    }
  }
  ```

### 3. “地中海泰萨”号超大型集装箱船 (Container Ship)

- **工程特性**：**参数剧烈漂移**。

- **控制难点**：满载（24万吨）和空载（8万吨）时，船的惯性 $T$ 和增益 $K$ 差异巨大。一套PID参数无法同时适应。

- **知识点映射**：**根轨迹参数扫描 (Ch4)**，**鲁棒性 (Ch6)**，**增益调度**。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "fleet-container-msc",
    "name": "MSC Tessa 集装箱船",
    "type": "fleet",
    "visualAsset": "assets/ships/container_msc.glb",
    "dynamics": {
      "baseModel": "Nomoto1stOrder",
      "modifications": {
        "variableMass": true, // 允许质量动态变化
        "windAreaMultiplier": 3.0 // 堆满集装箱后受风面积巨大
      }
    },
    "challenges": [
      "设计一个鲁棒控制器，在空载和满载下均不失稳",
      "抵抗强侧风干扰"
    ],
    "ethicalContext": {
      "dilemma": "准点率 vs 货物安全",
      "rules": ["侧倾角超过 10 度有丢箱风险，需强制减速"]
    }
  }
  ```

### 4. “爱达·魔都”号大型豪华邮轮 (Cruise Ship)

- **工程特性**：**频域舒适度要求**。

- **控制难点**：不是为了“准”，而是为了“稳”。必须压低 0.1Hz-0.3Hz 频段（让人晕船的频率）的响应幅度。

- **知识点映射**：**频率特性 (Ch5)**，**陷波滤波器**，**减摇鳍控制**。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "fleet-cruise-adora",
    "name": "爱达·魔都号邮轮",
    "type": "fleet",
    "visualAsset": "assets/ships/cruise_adora.glb",
    "dynamics": {
      "baseModel": "Nomoto2ndOrder",
      "modifications": {
        "finStabilizer": true, // 启用减摇鳍
        "passengerComfortMetric": true // 开启舒适度评价指标
      }
    },
    "challenges": [
      "在5级海浪下，将横摇幅度控制在 2 度以内",
      "设计滤波器滤除海浪频率"
    ],
    "ethicalContext": {
      "dilemma": "减摇鳍能耗 vs 游客体验",
      "rules": ["舒适度指数低于阈值时触发警报"]
    }
  }
  ```

### 5. “海洋石油981”深水半潜式钻井平台 (Drill Platform)

- **工程特性**：**多变量强耦合**。

- **控制难点**：动力定位 (DP) 系统。需要在 $X, Y, \Psi$ (航向) 三个自由度上同时控制，且相互干扰。

- **知识点映射**：**解耦控制 (Ch6/拓展)**，**现代控制理论初步**。

- **Profile 配置**：

  JSON

  ```
  {
    "id": "fleet-drill-hysy981",
    "name": "海洋石油981平台",
    "type": "fleet",
    "visualAsset": "assets/ships/platform_981.glb",
    "dynamics": {
      "baseModel": "3DOF_Coupled", // 3自由度耦合模型
      "modifications": {
        "currentDisturbance": "random_walk" // 随机海流
      }
    },
    "challenges": [
      "在强海流下保持定位精度 < 1m",
      "理解 X 轴推力对 航向 的耦合干扰"
    ],
    "ethicalContext": {
      "dilemma": "作业窗口期 vs 井喷风险",
      "rules": ["定位偏差超过红色警戒线必须紧急脱离"]
    }
  }
  ```
这是一个非常重要的补全。**“雪龙2号” (Xuelong 2)** 在我们的教学设计中扮演着**“生存挑战”**和**“鲁棒性验证”**的核心角色（第二课堂的终极关卡），因此它的配置必须具有极强的**不确定性**和**非线性特征**。

以下是为您补充的详细背景与 Profile 配置文件。

---

### 6. “雪龙2号”极地科考破冰船 (Polar Icebreaker)

#### A. 原型背景 (The Prototype)

* **对应原型**：中国首艘自主建造的极地科学考察破冰船 **“雪龙2号” (Xuelong 2)**。
* **核心特征**：
* **全球首创的双向破冰**：船艏和船艉均可破冰。
* **吊舱推进 (Azipod)**：无传统船舵，依靠两个可 360° 旋转的电力推进吊舱控制航向，机动性极强，但控制模型与传统舵大相径庭。
* **PC3 级破冰能力**：能以 2-3 节航速连续破 1.5 米冰 + 0.2 米雪。



#### B. 控制工程特性 (Engineering Traits)

1. **参数剧烈摄动 (Parameter Perturbation)**：
* **水  冰**：在开阔水域，它是标准的二阶惯性环节；一旦接触冰层，由于巨大的摩擦和撞击，系统增益  会瞬间下降，时间常数  会剧烈波动。
* **随机脉冲干扰**：破冰过程不是连续的阻力，而是“卡住-破碎-前进”的**Stick-Slip（粘滑）效应**，表现为高频大幅值的随机脉冲噪声。


2. **执行机构非线性**：
* 吊舱推进器在旋转时存在死区和速率限制。



#### C. 知识点映射 (Teaching Mapping)

* **根灵敏度与鲁棒性 (Ch4/6)**：考察闭环极点是否会因为开环参数变化  而跑出左半平面。
* **非线性控制 (Ch7)**：如何处理“粘滑”带来的极限环振荡。

#### D. Profile 配置文件 (The JSON)

```json
{
  "id": "fleet-icebreaker-xuelong2",
  "name": "雪龙2号极地科考船",
  "type": "fleet",
  "visualAsset": "assets/ships/xuelong2.glb",
  
  // 动力学配置：强调“不确定性”和“高机动性”
  "dynamics": {
    "baseModel": "Azipod_2ndOrder", // 吊舱推进二阶模型
    "physics": {
      "mass": 13990, // 吨
      "length": 122.5, // 米
      "designSpeed": 15.0 // 节
    },
    "modifications": {
      // 破冰模式：这是核心挑战
      "iceBreakingMode": {
        "enabled": true,
        // 参数摄动范围：增益下降 60%，时间常数增加 40%
        "parameterUncertainty": { "K_variation": [-0.6, 0.1], "T_variation": [-0.2, 0.4] },
        // 随机脉冲干扰：模拟冰层撞击
        "impulseDisturbance": { "magnitude": 5000, "frequency": "stochastic" }
      },
      // 吊舱特性：360度全回转，推力矢量控制
      "azipodDynamics": {
        "slewRateLimit": 12.0, // 吊舱转速限制 deg/s
        "thrustNonlinearity": true // 推力与转速的非线性关系
      }
    }
  },

  // 教学挑战任务
  "challenges": [
    {
      "id": "task-ice-station-keeping",
      "title": "冰区定点",
      "description": "在不均匀冰层撞击下，保持科考作业点位置误差 < 2m (鲁棒性考核)"
    },
    {
      "id": "task-ramming",
      "title": "冲撞破冰",
      "description": "利用倒车加速冲击冰脊，要求在冲击瞬间控制航向不偏离 (瞬态响应考核)"
    }
  ],

  // 伦理与非技术因素配置
  "ethicalContext": {
    "riskType": "survival_vs_science", // 生存 vs 科研
    "dilemmaScript": "polar_rescue", // 关联剧本：极地营救
    "constraints": [
      {
        "name": "推进器保护",
        "metric": "propeller_torque",
        "threshold": 95, // %
        "unit": "Rated",
        "consequence": "螺旋桨打坏，失去动力困于冰区"
      },
      {
        "name": "生态规避",
        "metric": "distance_to_wildlife",
        "threshold": 500,
        "unit": "m",
        "consequence": "惊扰企鹅/鲸鱼，违反南极条约"
      }
    ]
  }
}

```

### 补充说明

在 **Lesson 2 的“蓝军对抗”** 环节中，当您点击**“切换场景：破冰模式”**时，后台实际上就是加载了这个 JSON 配置。

* **前端表现**：画面从蓝色的平静海面瞬间变成白色的碎冰区，船体开始剧烈抖动。
* **后端逻辑**：将学生设计的控制器 $C(s)$ 与上述带有 `parameterUncertainty` 的对象 $P'(s)$ 组成闭环，计算其蒙特卡洛生存率。

------

## 四、 教学实施建议

1. **原子模型 (Atoms)**：嵌入在 **Lesson Builder** 的“微课”或“概念讲解”环节。例如，讲微分方程时，直接加载“减摇水舱”组件。
2. **旗舰模型 (055)**：作为 **Classroom Flow** 的默认背景。
3. **舰队模型 (Fleet)**：作为 **Homework & Challenge**。
   - **Level 1**: 通过 055 的考核。
   - **Level 2**: 抽取“挖泥船”任务（考察稳态误差）。
   - **Level 3**: 抽取“LNG船”任务（考察滞后处理）。

这份文档不仅定义了模型参数，更构建了一个完整的**“海工装备控制宇宙”**。它让每一个抽象的控制理论知识点，都能在茫茫大海上找到具体的落脚点。