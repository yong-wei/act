## Why

ACT 当前的 `destroyer` 场景仍消费旧式单文件 GLB，无法使用已经完成模型侧验证的南昌舰 101 号 v2.0.0 发布包，也无法保留该包的 LOD、独立活动节点、武器载荷和演示动画边界。现在需要建立一个受版本与哈希约束的候选接入路径，让后续实现代理能够完成接线，同时保证任何接入缺陷返回模型项目发布新版本，而不是在 ACT 内修改模型资产。

## What Changes

- 接收并登记 `type_055_destroyer_101_nanchang` v2.0.0 模型发布包，绑定发布 manifest、六个 GLB、逐文件 SHA-256、模型坐标系和模型侧验证报告。
- 为 `destroyer` 场景增加版本化模型包描述符：主舰 LOD0/1/2、碰撞体、武器 payload 和演示动画分别具有明确角色，不再把全部内容压入一个无版本 GLB。
- 在现有共享场景视觉管线中接入质量档位到 LOD 的选择，并保留 127 个主舰动画、8 个演示片段、活动节点、枢轴和自定义接口元数据。
- 保留现有 `destroyer.glb` 与当前内容寻址 Delivery 路径作为回退；新模型先以候选方式接入，生产激活、发布到 Delivery Bucket 和旧资产退役均不属于本变更。
- 接入验证必须覆盖 GLB 哈希、透明贴花、节点/动画清单、初始姿态、LOD 切换、回退行为和仿真驱动链不变。
- ACT 不修改上游模型网格、动画或导出包；若发现接口或资产缺陷，记录所需修订并等待 3DModels 发布新的模型版本。

## Capabilities

### New Capabilities

- `versioned-simulation-model-package-integration`: 定义外部版本化仿真模型包在 ACT 中的接收、身份绑定、角色清单、候选激活、回退和缺陷返版规则。

### Modified Capabilities

- `simulation-scene-visual-pipeline`: 让共享场景管线能够从版本化模型包选择质量档位对应的 LOD，并按需加载独立 payload/demo，同时保持场景加载、相机、质量降档和仿真驱动链合同。

## Impact

- 预计影响仿真模型资源登记、`destroyer` 场景装配、共享模型加载/质量档位适配、动画接口映射及相关单元和浏览器测试。
- 输入模型发布：`type055-nanchang-101` v2.0.0；源接受版 `.blend` SHA-256 为 `c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357`，发布 manifest SHA-256 为 `5901a821f7f955d4cafb0cd7c40420df506e24914de4abfa12678c7643f594b6`。
- 不修改 Rust/WASM 数值模型、`SimulationClock`、控制器、遥测和 Arena 评分；不执行生产发布、ACT 生产切换或上游模型修补。
