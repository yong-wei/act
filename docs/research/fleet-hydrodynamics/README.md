# 七船独立湿表面与执行器参数

计算依赖锁定于相邻 `nemoh-v3/requirements.lock`。当前生成物的精度等级为 `research-nominal`，逐项来源和待完成范围保存在各参数包与验证文件中。

## 981几何与一阶对照

`build_semisub_geometry.py`按#2147、#2161的双浮筒和四立柱生成封闭体积、湿表面与水线盖板。体积51800m³，质量53095000kg。横向GM固定为2m，由水线惯性矩和浮心得到单一KG=36.353925m，纵向GM相应为10.154440m。解析质量、惯量和恢复矩阵共同进入求解输入。

188、688、2432、6896湿面面元的横摇静水恢复离散误差约为7.95%、2.02%、0.69%、0.26%。生成的封闭体积误差达到浮点舍入量级。

688与2432面元均计算了零速129频率、24波向，互易/阻尼矩阵检查各有62和26项超出1%参考阈值。6896面元的七频率、三波向加密对照中，六通道离散响应峰值变化约0.14%至0.67%，部分阻尼互易检查仍超出阈值。完整频带的峰值、前进速度及在线表读取继续验证。机读记录和比较数组保存在 `semisub-validation/`。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_semisub_geometry.py --max-edge-m 5 --output /tmp/semisub-mesh
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/prepare_semisub_case.py --geometry-dir /tmp/semisub-mesh --output /tmp/semisub-input
rtk proxy /tmp/act-solvers/bin/python3 docs/research/nemoh-v3/run_case.py --source-dir /tmp/nemoh-v3 --build-dir /tmp/nemoh-build --case-dir /tmp/semisub-input --output /tmp/semisub-qtf-result
```

当前981差频输入覆盖17个波向和93个基础频率，采用零速DUOK+HASBO，完整自由面贡献和含航速差频处于待完成范围。双波同时旋转180°的角域扩展需通过同一几何的一阶对称性对照后使用。

## 055双轴与双舵参数包

`build_destroyer_pack.py`生成 `rust/control-engine/model-data/destroyer-055/v2/`。主尺度、质量、GM_T、设备高度及硬件限制来自#2147、#2158的固定T级定义。独立湿面采用参数化船形，固定Lpp、B、吃水后以纵向形状指数闭合排水体积。水线面积、浮心、水线惯性矩及同一KG共同决定恢复矩阵。

当前4128个三角面元的湿面给出KG=5.869862m、GM_L=239.241208m。初速8m/s时，双轴平衡转速127.520058rpm，每轴电机机械功约5.3603MW。轴惯性采用规定的25000(D/4)^5先验。逐数值的单位、来源、转换和未量化不确定性保存在 `provenance.json`。

完整B4-70 Fourier系数来自锁定的公开基准模块，进速使用rps与rad/s的显式转换。两个桨轴保留独立转速、电机响应、方位和功积分。驱动扭矩响应、正机械功限制、参考变化率及实际转速约束共同作用。电流约束在固定物理步内限制主动加速，水驱动超速超出执行能力时返回不可行状态。

舵和鳍使用统一有限翼失速曲线及六自由度安装点来流，力矩按实际作用点计算。双舵分别关联对应桨后流。当前黏性导数来自KVLCC2无量纲系数的B→T先验，低速和倒航采用21站点横流积分，纵向、横向、艏摇载荷及其重心力矩共用作用点速度。船型黏性校准、辐射拟合和波浪系数验证继续由#2157跟踪。

`sixdof-destroyer-v3`通过运行请求的 `parameterBundleVersion=research-nominal-v2`选择该包，完整执行器状态随 `sixdofState.actuatorStates`往返。现有标量请求继续使用其原版本合同。页面20步与其他六船的迁移由OpenSpec第0组继续跟踪。

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/fleet-hydrodynamics/build_destroyer_pack.py --output rust/control-engine/model-data/destroyer-055/v2
rtk proxy cargo test --manifest-path rust/control-engine/Cargo.toml --test sixdof_actuator_system
```

`destroyer-shaft-sensitivity.json`保存轴惯性先验0.5、1、2倍的三秒断电响应。转速随惯性增加保持单调关系，电机功、桨对水功、摩擦功与轴动能变化闭合。当前相对收支残差最大约4.7e-10。
