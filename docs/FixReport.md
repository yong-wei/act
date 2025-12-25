# 驱逐舰战术机动仿真修复报告

---

## 第七轮改进 (2025年12月25日)

### 1. 改进概述

本轮实现了以下三项改进：
1. **船舶跟随水面起伏**：高度 + 俯仰(pitch) + 横摇(roll)
2. **网格线固定在水面上方**：避免被海浪遮挡
3. **尾迹效果改进**：动态Mesh + 渐变透明度 + 波动动画

---

### 2. 实现细节

#### 2.1 船舶跟随水面起伏

**问题**：船舶固定在Y=0高度，海浪起伏时船舶被部分淹没。

**解决方案**：
1. 提取波浪参数为模块级常量 `waveParams`
2. 创建 `getWaveHeight(x, z, time)` 函数计算任意位置的水面高度
3. 在 `SimulationLoop` 中计算：
   - 船舶中心的水面高度 → 船舶Y坐标
   - 船首-船尾高度差 → 俯仰角(pitch)
   - 左舷-右舷高度差 → 横摇角(roll)
4. 使用 `lerp` 平滑过渡（惯性系数0.05），添加角度衰减系数（0.35）防止晃动过大

**代码关键点**：
```typescript
const shipDimensions = { length: 80, width: 20 };

// 计算四个关键点的水面高度
const centerY = getWaveHeight(posX, posZ, time);
const bowY = getWaveHeight(船首位置);
const sternY = getWaveHeight(船尾位置);
const portY = getWaveHeight(左舷位置);
const starboardY = getWaveHeight(右舷位置);

// 计算角度（带衰减）
const targetPitch = Math.atan2(bowY - sternY, length) * 0.35;
const targetRoll = Math.atan2(portY - starboardY, width) * 0.35;

// 平滑过渡
sim.waveY = lerp(sim.waveY, centerY, 0.05);
sim.wavePitch = lerp(sim.wavePitch, targetPitch, 0.05);
sim.waveRoll = lerp(sim.waveRoll, targetRoll, 0.05);
```

---

#### 2.2 网格线固定在水面上方

**问题**：网格线在Y=0.2位置，被海浪（最大振幅2.8）遮挡。

**解决方案**：将网格线高度从 `0.2` 提高到 `4`（高于最大波浪振幅）。

---

#### 2.3 尾迹效果改进

**问题**：原尾迹使用3条简单Line，视觉效果不自然。

**新实现**：V形扇面Mesh + 顶点颜色渐变 + 波动动画

**特点**：
- 使用 `BufferGeometry` 创建V形扇面
- 顶点颜色从白色(alpha=0.85)渐变到透明(alpha=0)
- 使用 `AdditiveBlending` 混合模式增强亮度
- 添加轻微的顶点Y坐标波动动画
- 尾迹跟随船舶波浪高度

**代码结构**：
```typescript
// 几何体：中心点 + 12层左右顶点对
positions: [中心(0,0.5,0), 左1,右1, 左2,右2, ...]
colors: [白色高透明, 渐变到透明...]
indices: 三角形扇面

// 材质
<meshBasicMaterial
  vertexColors
  transparent
  blending={AdditiveBlending}
  depthWrite={false}
/>
```

---

### 3. 修改文件

- `ai-obe-platform/src/components/simulations/destroyer-simulation.tsx`
  - 添加 `waveParams` 模块级常量
  - 添加 `getWaveHeight()` 函数
  - 添加 `shipDimensions` 常量
  - 扩展 `SimulationState` 类型（waveY, wavePitch, waveRoll）
  - 修改 `SimulationLoop` 计算波浪起伏
  - 修改 `GridHelper` 网格高度
  - 重写 `ShipWake` 组件

---

### 4. 验证情况

- ✅ `npm run lint` 通过
- ✅ `npm run test` 通过
- ✅ `npm run build` 成功

---

## 第六轮修复 (2025年12月25日)

### 1. 修复问题概述

本轮修复了以下三个问题：
1. **海面依然不可见**：波浪高度计算作用在错误的坐标轴上。
2. **尾迹方向错误**：尾迹仍然垂直于船身（从右舷变到左舷）。
3. **小地图航迹初始化异常**：初次进入仿真时，航迹显示在船前方而非船尾。

---

### 2. 问题根因分析

#### 2.1 海面不可见（根本原因）
- `PlaneGeometry` 默认在 XY 平面创建（Z=0）
- 使用 `rotation={[-Math.PI / 2, 0, 0]}` 旋转到 XZ 平面后：
  - 原始 Y 坐标变成 -Z 坐标
  - 原始 Z 坐标变成 Y 坐标
- 波浪代码修改 `positions[i + 1]`（原始 Y）实际上是在修改 **-Z 方向**，而不是高度！
- 因此整个海面平躺在 Y=-3 的位置，没有任何高度变化，被天空遮挡。

#### 2.2 尾迹方向错误
- 船舶运动公式：`x += speed * cos(heading)`, `z += speed * sin(heading)`
- heading=0 时船向 +X 方向移动
- 尾迹原始方向是 -X（`x = -t * wakeLength`）
- 旋转公式 `-headingRad - π/2` 在 heading=0 时让尾迹指向 -Z 方向（垂直于航向）
- 正确公式应该是 `-headingRad`，不需要额外的 π/2 偏移

#### 2.3 小地图航迹初始化异常
- `hud.position` 初始值是 `{x: 0, z: 0}`
- 实际场景起始位置是 `{x: -2700, z: 0}`
- 首次渲染时 useEffect 触发，在 (0,0) 位置记录了一个错误的航迹点
- 导致航迹从 (0,0) 延伸到实际位置，看起来像是"船前方"有航迹

---

### 3. 具体修复方法

#### 3.1 重构海面几何体创建
- **修改内容**：
    - 不再使用 `rotation` 属性旋转平面
    - 在 `useMemo` 中直接将 XY 平面转换为 XZ 平面
    - 将原始 Y 坐标移到 Z 坐标，新 Y 坐标初始化为 0
    - 波浪计算直接修改 Y 坐标，正确作用于高度
- **代码变更**：
    ```typescript
    const geometry = useMemo(() => {
      const geo = new THREE.PlaneGeometry(60000, 60000, 220, 220);
      const positions = geo.attributes.position.array as Float32Array;
      // 将XY平面转换为XZ平面
      for (let i = 0; i < positions.length; i += 3) {
        const originalY = positions[i + 1];
        positions[i + 1] = 0;           // Y坐标设为0
        positions[i + 2] = originalY;   // 原Y值移到Z坐标
      }
      geo.computeVertexNormals();
      return geo;
    }, []);
    ```
- **预期结果**：海面正确显示在水平面上，波浪在 Y 方向上下起伏。

#### 3.2 修复尾迹旋转公式
- **修改内容**：移除多余的 π/2 偏移
- **代码变更**：
    ```typescript
    // 原
    wakeRef.current.rotation.y = -sim.headingRad - Math.PI / 2;
    // 改为
    wakeRef.current.rotation.y = -sim.headingRad;
    ```
- **预期结果**：尾迹正确显示在船尾后方，沿航向反方向延伸。

#### 3.3 修复航迹初始化
- **修改内容**：添加 `skipFirstTrailUpdateRef` 标记，跳过首次航迹更新
- **代码变更**：
    ```typescript
    const skipFirstTrailUpdateRef = useRef(true);

    // resetScenarioState 中
    skipFirstTrailUpdateRef.current = true;

    // useEffect 中
    if (skipFirstTrailUpdateRef.current) {
      skipFirstTrailUpdateRef.current = false;
      trailStampRef.current = Date.now();
      return;
    }
    ```
- **预期结果**：初次进入或重置仿真后，航迹从实际起始位置开始记录，无错误点。

---

### 4. 修改文件

- `ai-obe-platform/src/components/simulations/destroyer-simulation.tsx`

---

### 5. 验证情况

修复完成后，需通过以下测试流程：
1. **代码规范检测**：`npm run lint`
2. **冒烟测试**：`npm run test`
3. **生产构建**：`npm run build`
4. **集成测试**：`npm run test:integration`（如有）

---

## 第五轮修复 (2025年12月25日)

### 1. 修复问题概述

本轮修复了以下两个问题：
1. **海面看不到**：`meshPhongMaterial` 受光照影响，海面颜色被严重冲淡。
2. **尾迹方向错误**：尾迹垂直于船身，而非在船尾后方。

---

### 2. 问题根因分析

#### 2.1 海面看不到
- `meshPhongMaterial` 受场景光照影响
- 即使降低光照强度，高亮的天空背景仍导致海面颜色被冲淡
- 需要使用不受光照影响的材质

#### 2.2 尾迹方向错误
- 船舶旋转公式：`-sim.headingRad + Math.PI / 2`
- 尾迹使用相同公式，导致与船舶方向相同
- 尾迹应指向船尾（加 `Math.PI`），即 `-sim.headingRad - Math.PI / 2`

---

### 3. 具体修复方法

#### 3.1 海面材质改为 meshBasicMaterial
- **定位代码**：`WaveWater` 组件的材质配置。
- **修改内容**：
    - 从 `meshPhongMaterial` 改为 `meshBasicMaterial`
    - 颜色设为 `#1a5a8a`（深海蓝）
    - 添加 `transparent` 和 `opacity={0.95}`
- **预期结果**：海面颜色不受光照影响，直接显示深蓝色。

#### 3.2 修复尾迹旋转方向
- **定位代码**：`ShipWake` 组件的旋转计算。
- **修改内容**：
    - 从 `-sim.headingRad + Math.PI / 2` 改为 `-sim.headingRad - Math.PI / 2`
- **预期结果**：尾迹正确显示在船尾后方。

---

### 4. 修改文件

- `ai-obe-platform/src/components/simulations/destroyer-simulation.tsx`

---

### 5. 验证情况

修复完成后，需通过以下测试流程：
1. **代码规范检测**：`npm run lint`
2. **冒烟测试**：`npm run test`
3. **生产构建**：`npm run build`
4. **集成测试**：`npm run test:integration`（如有）

---

## 第四轮修复 (2025年12月25日)

### 1. 修复问题概述

本轮修复了以下两个问题：
1. **海面颜色发灰**：海面和天空几乎融为一体，呈现灰白色，难以区分。
2. **缺少船舶尾迹浪花**：船舶驶过水面时没有白色泡沫/浪花效果。

---

### 2. 问题根因分析

#### 2.1 海面发灰原因
- **光照过强**：ambientLight(0.5) + hemisphereLight(0.6) + directionalLight(1.0) 总强度约 2.1
- **天空地平线颜色 `#d4e8f7` 与海面对比不足**
- **海面颜色在强光下被严重冲淡**

#### 2.2 缺少尾迹浪花
- 原有的 `ShipTrail` 组件只渲染绿色虚拟航迹线
- 没有实现船舶尾迹浪花（wake effect）

---

### 3. 具体修复方法

#### 3.1 降低光照强度
- **定位代码**：Canvas 内的光源配置。
- **修改内容**：
    - `ambientLight`: 0.5 → 0.3
    - `hemisphereLight`: 0.6 → 0.4，groundColor 改为 `#1a3a5a`，color 改为 `#87ceeb`
    - `directionalLight`: 1.0 → 0.8
- **预期结果**：总光照强度从 2.1 降至约 1.5，海面颜色不再被冲淡。

#### 3.2 调整海面材质
- **定位代码**：`WaveWater` 组件中的 `meshPhongMaterial`。
- **修改内容**：
    - 基础颜色 (`color`) 从 `#0066aa` 调整为 `#004488`（更深的海蓝色）
    - 自发光 (`emissive`) 从 `#003366` 调整为 `#001133`（更深）
    - 镜面高光 (`specular`) 从 `#4da6cc` 调整为 `#66aacc`
    - 光泽度 (`shininess`) 从 50 调整为 80
- **预期结果**：海面呈现明显的深蓝色，与淡蓝色天空形成鲜明对比。

#### 3.3 添加 ShipWake 船舶尾迹浪花组件
- **新增组件**：`ShipWake`
- **实现内容**：
    - V 形白色尾迹线（左右两侧）
    - 中心泡沫带（淡蓝白色）
    - 尾迹跟随船舶位置和朝向
    - 尾迹长度随船速变化（速度越快尾迹越长）
- **预期结果**：船舶驶过水面时会显示白色 V 形浪花尾迹。

---

### 4. 修改文件

- `ai-obe-platform/src/components/simulations/destroyer-simulation.tsx`

---

### 5. 验证情况

修复完成后，需通过以下测试流程：
1. **代码规范检测**：`npm run lint`
2. **冒烟测试**：`npm run test`
3. **生产构建**：`npm run build`
4. **集成测试**：`npm run test:integration`（如有）

---

## 第三轮修复 (2025年12月25日)

### 1. 修复问题概述

本轮修复了以下三个问题：
1. **海面颜色发灰**：海面颜色饱和度不足，与天空难以区分。
2. **小地图视图固定**：小地图显示全景视图，未跟随船舶移动；船舶三角形为绿色。
3. **航速连续变化**：手动模式下航速为连续平滑变化，需要改为按 1 m/s 步进。

---

### 2. 具体修复方法

#### 2.1 海面颜色优化
- **定位代码**：`WaveWater` 组件中的 `meshPhongMaterial`。
- **修改内容**：
    - 基础颜色 (`color`) 从 `#0a4a6e` 调整为 `#0066aa`（更鲜明的海蓝色）
    - 自发光 (`emissive`) 从 `#051a28` 调整为 `#003366`（增强深度感）
    - 镜面高光 (`specular`) 从 `#2a7fa8` 调整为 `#4da6cc`（更亮的反光）
    - 光泽度 (`shininess`) 从 60 调整为 50
- **预期结果**：海面呈现鲜明的深蓝色，与淡蓝色天空形成明显对比。

#### 2.2 小地图以船舶为中心 + 蓝色三角形
- **定位代码**：`MiniMap` 组件中的 `bounds` 计算和船舶三角形渲染。
- **修改内容**：
    - **动态视图**：将固定全景边界改为以船舶位置为中心的动态视图
        - 视野半径固定为 400 米
        - 边界跟随 `position.x` 和 `position.z` 实时更新
    - **三角形颜色**：从绿色 `#22c55e` 改为蓝色 `#3b82f6`
- **预期结果**：小地图视图跟随船舶移动，船舶显示为蓝色三角形。

#### 2.3 航速 1 m/s 步进控制
- **定位代码**：`SimulationLoop` 组件中的手动航速控制逻辑。
- **修改内容**：
    - 新增 `lastSpeedStepTimeRef` 控制步进间隔
    - 将连续加速模式（`speedLimits.accel * dt`）改为离散步进模式
    - 每 100ms 步进 1 m/s
- **预期结果**：按住方向键时，航速以 1 m/s 为单位连续递增/递减（约 10 m/s 每秒）。

---

### 3. 修改文件

- `ai-obe-platform/src/components/simulations/destroyer-simulation.tsx`

---

### 4. 验证情况

修复完成后，需通过以下测试流程：
1. **代码规范检测**：`npm run lint`
2. **冒烟测试**：`npm run test`
3. **生产构建**：`npm run build`
4. **集成测试**：`npm run test:integration`（如有）

---

## 第二轮修复 (2025年12月24日)

### 1. 修复问题概述

本轮修复了以下五个问题：
1. **曲线动画问题**：查看曲线时，每次数据刷新都会播放从底部"涨起来"的动画。
2. **海面视觉效果**：海面白茫茫一片，与天空难以区分，网格线不可见。
3. **曲线时间未重置**：重置仿真后，曲线的时间轴继续之前的时间，未从 0 开始。
4. **舵角步长问题**：舵角调节为连续平滑变化，用户需要每次 1 度的步进控制。
5. **90度转向任务判定**：航向偏差在 ±5° 保持 5 秒后，未能正确解锁下一任务。

---

### 2. 具体修复方法

#### 2.1 禁用曲线动画
- **定位代码**：`SimulationChart` 组件中的 Chart.js 配置。
- **修改内容**：
    - 在 `options` 中添加 `animation: false`。
- **预期结果**：曲线数据更新时平稳过渡，无动画效果。

#### 2.2 海面颜色与网格可见度优化
- **定位代码**：`WaveWater` 和 `GridHelper` 组件。
- **修改内容**：
    - **海面材质**：
        - 颜色从 `#004b6b` 调整为 `#0a4a6e`
        - 添加自发光 `emissive="#051a28"` 增强可见度
        - 镜面高光从 `#4fa3c7` 调整为 `#2a7fa8`
        - 光泽度从 120 降低到 60
    - **网格线**：
        - 透明度从 0.15 提升到 0.35
        - 线宽从 0.5 增加到 1.0
        - 颜色从白色 `#ffffff` 改为浅蓝色 `#88ccff`
- **预期结果**：海面呈现清晰的深蓝色，网格线清晰可见。

#### 2.3 曲线时间重置修复
- **定位代码**：`SimulationLoop` 和 `resetScenarioState`。
- **修改内容**：
    - 新增 `simulationStartTimeRef` 记录仿真开始时的时钟时间
    - 重置时将 `simulationStartTimeRef` 设为 -1，下一帧自动记录当前时间
    - 图表时间计算改为 `elapsedTime - simulationStartTimeRef`
    - 重置时清零 `lastChartSampleRef`
- **预期结果**：每次重置仿真后，曲线时间轴从 0 秒开始。

#### 2.4 舵角 1 度步进控制
- **定位代码**：`SimulationLoop` 中的手动舵角控制逻辑。
- **修改内容**：
    - 将连续变化率（25°/秒）改为离散步进模式
    - 每 100ms 步进 1 度
    - 新增 `lastRudderStepTimeRef` 控制步进间隔
- **预期结果**：按住方向键时，舵角以 1 度为单位连续递增/递减（约 10°/秒）。

#### 2.5 任务判定逻辑修复
- **定位代码**：任务检测的 `useEffect` 和 `setInterval`。
- **根本原因**：`hud.heading` 等频繁变化的状态在依赖数组中，导致 interval 被反复清除和重建，任务计时器无法稳定累积。
- **修改内容**：
    - 新增 `hudRef`、`targetHeadingRef`、`obstacleHitRef` 存储最新状态值
    - 通过独立的 `useEffect` 同步状态到 refs
    - interval 内使用 refs 读取最新值
    - 从依赖数组中移除 `hud.heading`、`hud.position`、`targetHeading`、`obstacleHit`
- **预期结果**：当航向偏差稳定在 ±5° 范围内持续 5 秒后，任务正确完成并解锁下一任务。

---

### 3. 验证情况

修复完成后，需通过以下测试流程：
1. **代码规范检测**：`npm run lint`
2. **冒烟测试**：`npm run test`
3. **生产构建**：`npm run build`
4. **集成测试**：`npm run test:integration`（如有）

---

## 第一轮修复 (2025年12月24日)

### 1. 修复问题概述

在驱逐舰战术机动仿真模块中，修复了以下四个核心问题：
1. **海面视觉效果**：原海面颜色偏灰，不够自然。
2. **小地图逻辑偏差**：小地图朝向与俯瞰视角不一致，且存在镜像反转现象，航迹和船头指向错误。
3. **数据重置失效**：重置仿真后，历史曲线数据未被清空。
4. **视图切换状态丢失**：从曲线界面返回仿真界面时，仿真状态会重置到起始点。

---

### 2. 具体修复方法

#### 2.1 自然海水颜色调整
- **定位代码**：`WaveWater` 组件中的 `meshPhongMaterial`。
- **修改内容**：
    - 将基础颜色 (`color`) 从 `#2c7fb8` 调整为更深邃的深蓝色 `#004b6b`。
    - 将镜面高光 (`specular`) 从 `#b3d9ff` 调整为青色调的 `#4fa3c7`。
- **预期结果**：海面色彩层次更丰富，光照效果更符合真实海域视觉。

#### 2.2 小地图朝向与镜像修正
- **定位代码**：`MiniMap` 组件。
- **修改内容**：
    - 移除了 SVG 容器上的 `transform: 'scaleY(-1)'` 样式，解决了坐标轴反向导致的镜像问题。
    - 修正了 `shipRotation` 的计算逻辑，移除了 `- 90` 的固定偏移，使其直接反映船舶的 `heading`（航向角）。
- **预期结果**：小地图的地理方位、航迹延伸方向及船头指向与 3D 视图完全一致。

#### 2.3 仿真重置逻辑优化
- **定位代码**：`resetScenarioState` 回调函数。
- **修改内容**：
    - 在重置函数中显式调用 `setChartData({ time: [], desiredHeading: [], actualHeading: [], speed: [] })`。
- **预期结果**：点击"重置仿真"后，不仅 3D 模型位置重置，背后的统计数据和实时曲线也同步归零。

#### 2.4 视图切换状态保持
- **定位代码**：`DestroyerSimulation` 组件的渲染逻辑。
- **修改内容**：
    - 将原有的条件分支渲染（Component Unmounting）改为显隐控制（CSS `hidden`）。
    - 即使在显示 `SimulationChart` 时，`SimulationCanvas` 及其相关的物理引擎状态依然在后台保持挂载。
- **预期结果**：用户在"仿真"与"曲线"界面间来回切换时，船舶的位置、航速和航向保持不变，仿真过程不会中断。

---

### 3. 验证情况

修复完成后，已通过以下标准测试流程：
1. **代码规范检测**：`npm run lint` 通过，无 ESLint 错误。
2. **冒烟测试**：`npm run test` 通过，关键组件及 API 路由加载正常。
3. **集成测试**：使用 Playwright 运行 `tests/destroyer.spec.ts`，模拟用户操作未发现运行时异常。
4. **生产构建**：`npm run build` 成功完成，无编译错误。
