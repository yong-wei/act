# 七船独立湿表面与执行器参数

计算依赖锁定于相邻 `nemoh-v3/requirements.lock`。当前生成物的精度等级为 `research-nominal`，逐项来源和待完成范围保存在各参数包与验证文件中。

## 981几何与一阶对照

`build_semisub_geometry.py`按#2147、#2161的双浮筒和四立柱生成封闭体积、湿表面与水线盖板。体积51800m³，质量53095000kg。横向GM固定为2m，由水线惯性矩和浮心得到单一KG=36.353925m，纵向GM相应为10.154440m。解析质量、惯量和恢复矩阵共同进入求解输入。

188、688、2432、6896湿面面元的横摇静水恢复离散误差约为7.95%、2.02%、0.69%、0.26%。生成的封闭体积误差达到浮点舍入量级。

688与2432面元均计算了零速129频率、24波向，互易/阻尼矩阵检查各有62和26项超出1%参考阈值。6896面元的七频率、三波向加密对照中，六通道离散响应峰值变化约0.14%至0.67%，部分阻尼互易检查仍超出阈值。完整频带的峰值、前进速度及在线表读取继续验证。机读记录和比较数组保存在 `semisub-validation/`。

6896面元随后完成129频率、单个0°波向计算。15项阻尼矩阵检查未达参考目标，0.575至0.625rad/s互易误差约1.08%至1.26%，高频段存在负特征值。原始结果保留在同一机读对照中，相应频段的精度与在线使用继续待核验。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_semisub_geometry.py --max-edge-m 5 --output /tmp/semisub-mesh
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/prepare_semisub_case.py --geometry-dir /tmp/semisub-mesh --output /tmp/semisub-input
rtk proxy /tmp/act-solvers/bin/python3 docs/research/nemoh-v3/run_case.py --source-dir /tmp/nemoh-v3 --build-dir /tmp/nemoh-build --case-dir /tmp/semisub-input --output /tmp/semisub-qtf-result
```

981差频实际计算已完成7579314行，覆盖17×17波向对和93个基础频率的六通道下三角复数表。`semisub-qtf-validation/`保留冻结输入、原始样本和对称性残差，完整57.17MB受控数组另存并记录哈希。均频率Hermitian及共同180°旋转对照已计算，±30°七方向波场有几何覆盖，任意24×24方向对仍有98对缺失。当前范围为零速DUOK+HASBO，完整自由面贡献、含航速差频及在线完整复数表读取继续待完成。

完整复数差频的Rust读取与合成已由`full-qtf-runtime.md`记录。实际读取60.63MB运行数组，896波分量、120次六通道载荷与SciPy完整有序双重和对照约3.3e−14至6.5e−14相对差。WASM对象、平均姿态/作用坐标和981页面的挂接继续实施。

## 981基础运行参数

`build_semisub_pack.py`把同一工作湿面与八个下挂轴系装配为semisub-981/v1，源几何及NEMOH网格哈希与已计算差频表核对。基准质量53095吨、单一KG36.353925m，横/纵GM分别为2m/10.154440m。自由板立柱上沿选择龙骨以上40m，按T级生成器假设保存。八台D4.5m、4.6MW、180rpm轴系具有真实电机/转速/方位动态，完整球包络净空下界0.75m。

构件低频阻力由六个冻结平均湿面矩形在三种投影方向分别采用21×21中点积分，速度包含相对平均流和作用点ω×r，完整六维载荷进入实际RK。九项直接回归及Rust全量379项通过，原始WASM对象证明位于semisub-session-validation.json。DP/分配、电力/射流运行限制、拟合辐射及在线波浪数据继续由参数包未完成清单和OpenSpec管理。

semisub-981/v2已追加同源A_inf及52振子、104状态的六维被动辐射。实际RK使用相对速度记忆及完整旋转海流导数，同一A_inf进入总质量与C_A。原始A/B拟合残差4.82%/12.64%按research-nominal保留，数值组装与SciPy独立状态空间对照约1e−16。九项直接、Rust全量395项、十五个真实WASM对象和旧恢复点通过，证据及复现命令见`semisub-radiation-validation/README.md`。

## 055双轴与双舵参数包

`build_destroyer_pack.py`生成 `rust/control-engine/model-data/destroyer-055/v3/`。主尺度、质量、GM_T、设备高度及硬件限制来自#2147、#2158的固定T级定义。源模型为已发布的v2.3.0 GLB，提取HULL_MAIN、HULL_FORE_PATCH并核对GLB、清单、解码器和坐标变换哈希。原组合表面存在开口，经过配对横剖面采样、独立闭合重建以及固定排水量归一化形成物理湿面。LOA=180m用于外形缩放，Lpp=171m用于操纵无量纲化。

4009个湿面三角面元给出KG=9.880288m、GM_L=475.829137m，15885面元的剖面采样对照给出9.863233m和474.470529m。两份几何分别归一化至相同质量，此对照记录采样敏感性。封闭多面体的体积、浮心与水线积分共同确定恢复矩阵，保留升沉—纵摇耦合。Capytaine面元静水恢复对照的离散误差单列在验证文件中。初速8m/s时，双轴平衡转速127.520058rpm，每轴电机机械功约5.3603MW。轴惯性采用规定的25000(D/4)^5先验。逐数值的单位、来源、转换和未量化不确定性保存在 `provenance.json`。

原桨盘x=−76.95m在两份源剖面几何中分别与船体相交约0.2741m²和0.2764m²。按#2147的几何冲突修订规则，将新版本轴心移至x=−78m，完整桨盘净空分别约0.09392m和0.04676m。舵仍位于x=−82.08m，通过三角面元分段包络与解析扫掠弦长界核验完整±35°范围。`envelope-validation.json`保存输入哈希、修订前后结果、完整包络和封闭性证明。网格坐标使用17位有效数字保存。

完整B4-70 Fourier系数来自锁定的公开基准模块，进速使用rps与rad/s的显式转换。两个桨轴保留独立转速、电机响应、方位和功积分。驱动扭矩响应、正机械功限制、参考变化率及实际转速约束共同作用。电流约束在固定物理步内限制主动加速，水驱动超速超出执行能力时返回不可行状态。

舵和鳍使用统一有限翼失速曲线及六自由度安装点来流，力矩按实际作用点计算。双舵分别关联对应桨后流。当前黏性导数来自KVLCC2无量纲系数的B→T先验，低速和倒航采用21站点横流积分，纵向、横向、艏摇载荷及其重心力矩共用作用点速度。船型黏性校准、辐射拟合和波浪系数验证继续由#2157跟踪。

`sixdof-destroyer-v3`通过运行请求的 `parameterBundleVersion=research-nominal-v3`选择源剖面包，完整执行器状态随 `sixdofState.actuatorStates`往返。v1和前一参数化v2仍按显式版本读取。页面20步与其他六船的迁移由OpenSpec第0组继续跟踪。

```bash
rtk proxy node docs/research/fleet-hydrodynamics/extract_hull_mesh.mjs --release public/assets/model-releases/type055-nanchang-101/v2.3.0 --node HULL_MAIN --node HULL_FORE_PATCH --output /tmp/055-source
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/sample_hull_sections.py --source /tmp/055-source --output rust/control-engine/model-data/destroyer-055/v3/source-sections.json
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_destroyer_pack.py --output rust/control-engine/model-data/destroyer-055/v3
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_destroyer_pack.py --longitudinal-panels 172 --vertical-panels 24 --output /tmp/055-fine
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/validate_hull_pack.py --pack rust/control-engine/model-data/destroyer-055/v3 --comparison-pack /tmp/055-fine
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_actuator_system
```

`destroyer-shaft-sensitivity.json`保存轴惯性先验0.5、1、2倍的三秒断电响应。转速随惯性增加保持单调关系，电机功、桨对水功、摩擦功与轴动能变化闭合。当前相对收支残差最大约4.7e-10。

## 非线性静水与自由板

`extend_destroyer_hull.py`在v3原始水线上承接源模型自由板，保持湿面和离线系数输入字节一致。v4的8178面三角船体在当前姿态下裁切平均水面，排水体积、浮心、重力/浮力与势能取自同一多面体积分。恢复载荷进入每个RK子阶段及输出分项，参数包加载时核验闭合、法向、体积及声明姿态的平衡。

自由板沿用既有湿面的纵向范围，范围外的艏艉干悬伸进入水面仍列为未就绪。适用域限定为完整船体和甲板上浪之前的姿态。解析箱体、30°横倾、势能梯度、保守能量、完全出水/浸没、源模型小角度矩阵及常驻会话恢复共八项直接回归通过。

`validate_native_session.mjs`实际调用生成WASM，验证原始快照、测量反馈控制、暂停和120Hz/20Hz时钟。四船记录保存在对应session-validation.json。Node单对象时间的测量范围为数值调用，生产并发和网络容量由第6组另行实测。

新建会话的航向控制器采用测量微分和默认0.2s滤波，积分舵令贡献按1s回算时间跟踪受限命令。缺测保持操纵命令并冻结积分/微分。控制状态进入v2快照及原生帧。`capture_legacy_session_fixture.mjs`已从改动前ae293273fe的实际WASM捕获带噪声/风的PID恢复点，`validate_legacy_session.mjs`核验新WASM恢复该v1快照后的完整未来原始字节。旧恢复点及证明位于Rust tests/fixtures/native-session-legacy-v1和legacy-session-restore-validation.json。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/sample_hull_sections.py --source /tmp/055-source --include-freeboard --fill-profile-gaps --output /tmp/055-full-sections.json
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/extend_destroyer_hull.py --previous-pack rust/control-engine/model-data/destroyer-055/v3 --full-source-sections /tmp/055-full-sections.json --output /tmp/055-v4
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_hydrostatics
rtk npm run wasm:build:control-engine
rtk proxy node docs/research/fleet-hydrodynamics/validate_native_session.mjs --version research-nominal-v4
```

`build_ship_geometry.py`接续五个常规船型的同源水下/自由板轮廓、装载、最小压载和纵倾求解。源GLB的实例质量代理与原始包围体积均以T级记录。原集装箱甲板单组候选在高载下静水不稳定，失败证明继续保留。经用户审定的甲板/内舱新分布及LNG有效GM解释已形成正式加载包，参数和核验见`loading-validation/README.md`。

## 邮轮、雪龙2号与天鲸基础包

`build_vessel_pack.py`由已闭合几何装配版本化T级多轴/多翼与非线性静水参数。三个v1包位于`rust/control-engine/model-data/`相应船型目录，源剖面内保留所选节点、坐标变换、缺口修补及来源哈希。粗/细几何均以相同质量和吃水归一化，细网格采用172个纵向、24个垂向区间。

| 船型 | GLB版本 | 船体节点或采样范围 |
| --- | --- | --- |
| 爱达·魔都号 | adora-magic-city/v1.1.0 | STATIC_88_AMC_HULL_PORT、STATIC_89_AMC_HULL_STARBOARD、STATIC_117_MAT_HULL_RED_G02 |
| 雪龙2号 | xue-long-2/v1.1.0 | XL2_BATCH_56、XL2_BATCH_41、XL2_BATCH_42，排除两个吊舱外壳连通分量 |
| 天鲸号 | dredger-tianjing/v1.2.0 | TJ_BATCH_000、001、002、004，主甲板船体范围限制在原水线上3.2m |

完整运动包络揭示原T级布局的碰撞。新包把邮轮鳍中心移至y=±21.75m、雪龙吊舱移至x=−53.5m、天鲸桨/舵分别移至x=−60.5/−62.5m，龙骨高度继续采用公共合同。修订前后配置、实际碰撞原因、粗细几何哈希和全角度证明保存在各包`validation.json`。全回转吊舱使用全部垂直桨盘并集对应的球体核验，翼面使用连续扫掠界。

三个包已接入`VesselSimulationSession`的P0/C1/C2基础工况，双艉吊舱采用对称同角的初级航向分配，鳍单独接受实际角命令。风载投影、波浪域、冰接触和疏浚机构继续由OpenSpec剩余任务实施。`cruise-session-validation.json`、`icebreaker-session-validation.json`及`dredger-session-validation.json`记录同一WASM构建下的对象恢复、暂停和固定时钟验证。

## 水动力与液舱耦合证据

`destroyer-first-order-validation/`保存055零速129频率×24波向和8m/s的17频率×3波向原始A/B/激励/RAO数组、完整维度及求解证明。零速72项矩阵参考检查失败，含航速工况的零速互易/被动性检查按不适用记录。两类数据的网格和适用域状态继续待验证。

`sloshing-coupling-derivation.md`记录完整液舱耦合的势梯度积分、作用高度、质量分配、余伴随项与势能。实际RK和快照已接入该拉格朗日系统，全量Rust353项及随后空间惯性/恒定转向修订的液舱专项7项通过。LNG给定基准GM在纯几何解释下出现负有效稳性，原输入保存在`lng-frozen-cargo-geometry-reference.json`，对应独立体积分结果在`sloshing-coupling-integral-validation.json`。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/verify_sloshing_coupling.py --geometry docs/research/fleet-hydrodynamics/lng-frozen-cargo-geometry-reference.json --output /tmp/sloshing-integral-verification.json
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_coupled_sloshing
```

`container-loading-candidate-validation/`保留可见甲板集装箱均匀密度代理的.6/.9装载候选。该候选在.9得到GM_T约−4.8333m，并输出not_ready证明。2026-11-14用户审定含舱内货载的新T级分布。

## LNG与集装箱正式加载包

lng-changheng/v1包含.30/.70/.85/.95填充，container-msc/v1包含.20/.35/.60/.80/.90装载。`build_loading_cases.py`核验固定质量分布与完整船壳保持一致，加载表共享船壳顶点，并保存各状态的实际质量、KG、惯量、吃水、纵倾、执行器和初始液面。原生会话通过`loadingRatio`在重置时选取冻结状态，实际内容哈希随参数变化。

LNG基准几何GM为5.563340m，经3.063340m第一模态修正后有效GM为2.5m。集装箱采用基准80%甲板/20%内舱质量及基准后固定甲板质量的T级策略，高载GM为1.164064m。最小压载、同一KG的粗细几何对照、65MW受限初始化及实际验证范围见`loading-validation/README.md`。

新增七项加载回归、Rust全量386项、七船基准及七个加载状态的十四个真实WASM对象通过。液舱实际响应、完整未来/旧恢复点对账和类型检查通过。波浪/辐射、专属控制和正常页面继续按OpenSpec剩余任务实施。

邮轮、雪龙及天鲸已完成新内部自由面盖板的130频率×24波向计算，原始A/B、复激励和RAO全部有限，矩阵参考检查失败继续保留。九组原始/代表/完整计算、盖板几何与输入漂移直接回归见`bem-lid-validation.md`。
## 原生会话的实际波浪数据

981 v4的`wave-assets.json`登记一阶和差频元数据、数据SHA-256、字节数及内容寻址对象键。WASM入口`VesselSimulationSession.withWaveTables`接收配置、两份元数据和对应小端数组。普通单参数构造函数继续支持已有参数包。会话恢复按参数包身份重新装配数据能力，未知数组、缺少所需数组和加载条件冲突均返回明确错误。

120Hz实际RK同时消费一阶及DUOK+HASBO差频载荷。冻结平均航速/艏向，波面、局部流和载荷使用同一896分量相位，当前船位进入空间相位，完整姿态进入六维载荷旋转。环境消融和二阶开关独立，完整未来、暂停、重置、错误恢复及旧v1未来字节在实际WASM通过。来源误差、自由面/渐近项、前进速度与收敛边界继续保留在元数据和计划中。

```bash
rtk proxy node docs/research/fleet-hydrodynamics/validate_wave_session.mjs --first-order /tmp/act-semisub-first-order-runtime-bound-20261114 --full-difference /tmp/act-semisub-qtf-runtime-bound-final-20261114 --output /tmp/semisub-wave-session-validation.json
```

上述程序覆盖P0/V1/V2/V3/E1/E2，结果保存在`semisub-wave-session-validation.json`。单Node进程计时覆盖数组解析、原生积分和恢复，浏览器页面与生产容量继续单独验收。
