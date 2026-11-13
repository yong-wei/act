# 离线水动力求解与基准记录

NEMOH固定v3.0.3，源码提交09853686f6f3ed78823d9dbec0d1d711c015cb3b。Capytaine固定2.2.1。隔离Python环境的全部依赖版本见requirements.lock，实际工具与输入/输出哈希随结果保存。[NEMOH](https://gitlab.com/lheea/Nemoh/-/tree/v3.0.3) [Capytaine问题配置](https://capytaine.org/v2.2.1/user_manual/problem_setup.html)

## 2026年11月14日实际计算

- Capytaine对官方Cylinder湿面计算6自由度、50个频率的一阶系数，频率为0.1至2rad/s，600个湿面面元。相同CG与密度下，对照Aquaplus的纵荡/垂荡/纵摇附加质量和阻尼，归一化L2误差分别约0.50%/0.98%、0.15%/1.86%、0.48%/0.29%。零速互易性与阻尼被动性检查通过。
- NEMOH完整执行官方8b_QTF_Cylinder/mesh634_floating基准，100个一阶频率、65个二阶频率，DUOK+HASBO。每个自由度2145个频率对，6自由度共12870行差频数据全部有限。
- 对照相同案例HydroSTAR原始数据，在共同频域内每通道1275个频率对，差频幅值L2误差为纵荡28.83%、垂荡8.09%、纵摇17.37%。复数误差与原始比较数组一并保存。当前成果保持research-nominal，后续继续核验相位、载荷组成、RAO、网格与适用海况。

cylinder-validation/validation.json保存来源、工具、计算阶段、原始文件哈希和误差。comparison-arrays.npz保存完整差频输出与对照数组，可独立复算上述指标。

## 数值修正

原版NEMOH在本机GNU Fortran 15.2的Release构建下，差频结果出现204行非有限系数，全部位于相同频率对。原因是sqrt(k1²+k2²−2k1k2cosΔβ)在相同波向、相同频率时产生消减误差。numerical-stability.patch用等价二维波数向量的范数计算和频/差频模长。重新运行完整基准后差频全表有限。

补丁还使BUILD_TESTING=OFF生效，从而可独立编译求解器并按所选案例运行。求解器修改保存在独立离线源码目录。补丁遵循上游GPL-3.0-or-later，程序在离线进程执行。[上游许可证](https://gitlab.com/lheea/Nemoh/-/blob/v3.0.3/LICENSE.txt)

## 复现

在Python 3.12隔离环境安装锁定依赖，运行脚本时使用对应环境的python3。

```bash
rtk proxy python3.12 -m venv /tmp/act-solvers
rtk proxy /tmp/act-solvers/bin/python3 -m pip install -r docs/research/nemoh-v3/requirements.lock
rtk proxy git clone --depth 1 --filter=blob:none --no-checkout --branch v3.0.3 https://gitlab.com/lheea/Nemoh.git /tmp/nemoh-v3
rtk proxy git -C /tmp/nemoh-v3 sparse-checkout init --cone
rtk proxy git -C /tmp/nemoh-v3 sparse-checkout set Common Mesh Solver QTF preProcessor postProcessor cmake external TestCases/1_Cylinder TestCases/5_QuickTests TestCases/8b_QTF_Cylinder TestCases/9_QTF_OC4_Semisubmersible
rtk proxy git -C /tmp/nemoh-v3 checkout --detach HEAD
rtk proxy git -C /tmp/nemoh-v3 apply --unidiff-zero "$PWD/docs/research/nemoh-v3/numerical-stability.patch"
rtk proxy /tmp/act-solvers/bin/cmake -S /tmp/nemoh-v3 -B /tmp/nemoh-build -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release
rtk proxy /tmp/act-solvers/bin/cmake --build /tmp/nemoh-build --parallel 4
rtk proxy /tmp/act-solvers/bin/python3 docs/research/nemoh-v3/run_case.py --source-dir /tmp/nemoh-v3 --build-dir /tmp/nemoh-build --case 8b_QTF_Cylinder/mesh634_floating --output /tmp/nemoh-cylinder-result
```

run_case.py为每次计算使用新的结果目录，保存阶段日志、程序与输入/输出哈希，并拒绝缺失结果及非有限QTF。相邻capytaine-s175目录的solve_first_order.py生成一阶数据。该Cylinder对照使用其同一湿面、CG=(0,0,−7.5)m、密度1000kg/m³、无限水深、50点等间隔频率0.1至2rad/s和波向0度。

```bash
rtk proxy /tmp/act-solvers/bin/python3 - <<'PYTHON'
import subprocess
import sys
import numpy as np

subprocess.run([
    sys.executable, 'docs/research/capytaine-s175/solve_first_order.py',
    '--mesh', '/tmp/nemoh-v3/TestCases/1_Cylinder/Cylinder.dat',
    '--mesh-format', 'nemoh', '--name', 'nemoh-cylinder-aquaplus',
    '--center-of-mass', '0', '0', '-7.5', '--density-kg-m3', '1000',
    '--water-depth-m', 'inf', '--frequencies',
    *[str(value) for value in np.linspace(0.1, 2.0, 50)],
    '--headings-deg', '0', '--output', '/tmp/capytaine-cylinder-result',
], check=True)
PYTHON
```

```bash
rtk proxy /tmp/act-solvers/bin/python3 docs/research/nemoh-v3/validate_benchmarks.py --source-dir /tmp/nemoh-v3 --build-dir /tmp/nemoh-build --qtf-results /tmp/nemoh-cylinder-result --first-order-results /tmp/capytaine-cylinder-result --output /tmp/cylinder-validation
```

验证脚本严格核对频率对应，仅比较两份数据的共同频域，并从NEMOH归一化输出乘回rho×g后对照SI值。未覆盖的七船几何、前进速度、有限水深和载荷条件继续由各自参数包记录。
