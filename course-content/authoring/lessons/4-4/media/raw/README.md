# 4-4 数值产线说明

本目录用于生成单元 `4-4` 的优化建模案例数据与图像。

## Octave 依赖

首次使用前，先在本机 Octave 环境安装并校验下面的包：

```bash
octave --quiet --eval "pkg install -forge struct"
octave --quiet --eval "pkg install -forge datatypes"
octave --quiet --eval "pkg install -forge statistics"
octave --quiet --eval "pkg install -forge optim"
octave --quiet --eval "pkg list"
octave --quiet --eval "pkg load optim; which fmincon"
```

本课的后台优化脚本依赖 `control` 与 `optim`。其中：

- 航向保持主案例使用 `fmincon` 完成有界参数搜索；
- 横摇边界案例使用一维参数搜索补充“任务通道变化后，目标函数必须改写”的证据链。

## 生成步骤

1. 生成优化数据：

```bash
octave --quiet course-content/authoring/lessons/4-4/media/raw/generate_optimization_data.m
```

2. 生成图像：

```bash
python3 course-content/authoring/lessons/4-4/media/raw/render_optimization_figures.py
```

## 产物

- `generated-data/4-4-optimization-data.json`
- `../processed/4-4-ship-heading-optimization-compare.png`
- `../processed/4-4-roll-optimization-compare.png`
