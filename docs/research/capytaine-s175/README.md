# S175一阶频域数据库与求解入口

源库锁定MSS提交e8ab42a105cd45770179609307a2175cede009b5中的HYDRO/vessels_capytaine/S175/s175.mat。源文件SHA-256为e95dac93a70194aa3ff0a11223c2b6d125073638b6d387e65ba299c2a4f003d1。[源库](https://github.com/cybergalactic/MSS/blob/e8ab42a105cd45770179609307a2175cede009b5/HYDRO/vessels_capytaine/S175/s175.mat)

2026年11月14日重新取回原文件，并对照已有夹具核验38个频率、MRB、A、B和C，全部数值差为零。extract_hydrodb.py校验源文件哈希后可重新导出测试夹具，输出同时记录来源和生成器哈希。

```bash
rtk proxy python3 docs/research/capytaine-s175/extract_hydrodb.py --input /tmp/s175.mat --output rust/control-engine/tests/fixtures/s175_hydrodb.json
```

夹具导出6×6×38的附加质量、阻尼与恢复矩阵，以及质量和主尺度。原库还包含波浪激励和运动RAO，当前夹具使用上述矩阵进行独立校验。源库航速为零。

## 装载与校验

该库吃水9.5米、排水体积23973.245m³、横向GM约0.98米。container.m时域基准的吃水为8.5米，计算对照分别保留其加载条件。

Rust的sixdof_s175_hydrodb测试核验来源标识、质量矩阵、静水恢复、自由横摇周期与附加质量量级。它提供数据库物理一致性的证据，逐船实际求解及其网格收敛由生产参数包记录。

源库声明质量与rho×排水体积相差0.1505%，C55与rho×g×排水体积×GM_L相差约1.22%。夹具保留原值，数据接入逐船参数包时须处理其加载及参考点差异。

## 独立网格求解

solve_first_order.py接收独立湿表面网格、重心、工况与频率列表，固定使用Capytaine 2.2.1，输出hydro.nc和provenance.json。包含6×6附加质量/阻尼及复绕射、Froude–Krylov激励，零速检查长度归一化后的互易性和阻尼矩阵被动性。前进速度通过求解器的forward_speed参数传入。

输入质量可选，提供后必须与当前水线下排水体积闭合。重心采用米、z向上。水深支持有限正值和inf。软件环境锁定于相邻nemoh-v3目录的requirements.lock，结果记录求解器与依赖实际文件哈希。

```bash
rtk proxy python3 docs/research/capytaine-s175/solve_first_order.py --mesh /tmp/body.dat --mesh-format nemoh --name vessel --center-of-mass 0 0 0 --water-depth-m 200 --frequencies 0.5 0.75 1.0 --headings-deg 0 90 --output /tmp/first-order-result
```

运行生成状态为computed或failed。独立基准和网格收敛的验收结果由相应验证记录给出，默认模型可信度为research-nominal。
