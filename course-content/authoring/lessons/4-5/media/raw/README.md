# 4-5 数值产线说明

本目录用于生成单元 `4-5` 的“无约束解失真”与“三方案约束闭环”图证。

## 目标

`4-5` 的主线不再重复 `4-4` 的优化建模，而是直接回答：若只沿着“更快、更小代价”的方向搜索，为什么会先得到工程上不可用的候选解。为此，本目录只保留客船航向保持的三类方案：

- `4-3` 起始方案
- 弱约束候选解
- 带约束可用解

## 依赖

脚本依赖 `Octave` 的 `control` 包。

## 生成步骤

1. 生成数据：

```bash
octave --quiet course-content/authoring/lessons/4-5/media/raw/generate_constraint_data.m
```

2. 生成图像：

```bash
python3 course-content/authoring/lessons/4-5/media/raw/render_constraint_figures.py
```

## 产物

- `generated-data/4-5-constraint-data.json`
- `../processed/4-5-ship-heading-unconstrained-failure-compare.png`
- `../processed/4-5-ship-heading-constraint-closure-compare.png`
