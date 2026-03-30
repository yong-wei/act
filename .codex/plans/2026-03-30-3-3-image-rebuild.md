# 2026-03-30 `3-3` 图片重建计划

## 目标

- 修复 `3-3` 讲义中全部 `pp` 图片的三类问题：
  - 公式未渲染，直接暴露 `$...$` 或 TeX 片段；
  - 根轨迹曲线由稀疏采样折线化，起点和分离点附近不平滑；
  - 文本框遮挡、超框和排版拥挤。

## 根因

1. 当前若干 SVG 直接把 LaTeX 字符串写入 `<text>` 节点，浏览器不会自动渲染公式。
2. 当前根轨迹曲线用自定义参数扫描和较粗采样生成，分离点与转折区间不够平滑。
3. 当前图片布局是手工坐标硬拼，缺少脚本化的尺寸约束和导出后人工核验。

## 执行步骤

1. 保留现有文件名，新增脚本化生成链路。
2. 用 `Octave + control` 生成 `3-3` 根轨迹相关数据或独立绘图底板。
3. 用 `Python + matplotlib` 统一渲染公式、标题、说明框和整体布局。
4. 重生 `3-3-pp-01` 至 `3-3-pp-08`。
5. 批量渲染 PNG 预览，逐张人工核验并修正。
6. 运行测试，至少保证：
   - `pp` SVG 中不再出现原始 `$`；
   - 全部 SVG 是合法 XML；
   - 讲义引用路径存在。

## 受影响文件

- 新增：
  - `course-content/authoring/lessons/3-3/media/raw/3-3-generate-plot-data.m`
  - `course-content/authoring/lessons/3-3/media/raw/3-3-generate-panels.py`
  - `course-content/tests/test_3_3_media_generation.py`
- 修改：
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-01-root-locus-roadmap.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-02-generalized-root-locus-map.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-03-angle-and-magnitude-geometry.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-04-complete-rules-example.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-05-real-axis-parity.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-06-departure-arrival-angle.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-07-generalized-time-constant-example.svg`
  - `course-content/authoring/lessons/3-3/media/processed/3-3-pp-08-dynamics-translation.svg`
  - 必要时同步 `course-content/authoring/lessons/3-3/design/multimedia.md`
