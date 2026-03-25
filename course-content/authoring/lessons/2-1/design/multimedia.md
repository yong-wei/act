# 多模态资源设计 | 单元 2-1：建模与变换语言

> **资源总数**：14 项
> **生成方式分布**：TikZ / 代码直出图 13 项，视频提示词 1 项
> **当前状态**：讲义所需结构图与空白信息图由脚本生成；封面漫画本轮只保留中文提示词，不生成占位图。

---

## 资源总表

| 编号 | 文件名 | 用途 | 生成方式 | 引用于 | 状态 |
|:---:|:---|:---|:---|:---|:---|
| h-02 | `md-02-series-equivalent.png` | 讲义 | TikZ 方框图 | `handout.md` §2.4.1 | 已生成 |
| h-03 | `md-03-parallel-equivalent.png` | 讲义 | TikZ 方框图 | `handout.md` §2.4.2 | 已生成 |
| h-04 | `md-04-feedback-equivalent.png` | 讲义 | TikZ 方框图 | `handout.md` §2.4.3 | 已生成 |
| h-05 | `md-05-ship-heading-physical-blocks.png` | 讲义 | TikZ 方框图 | `handout.md` §2.4.4 | 已生成 |
| h-06 | `md-06-block-vs-sfg.png` | 讲义 | TikZ 对照图 | `handout.md` §2.5.1 | 已生成 |
| h-07 | `md-07-example-ship-loop.png` | 讲义 | TikZ 方框图 | `handout.md` 例题1题面后 | 已生成 |
| h-08 | `md-08-example-ship-sfg.png` | 讲义 | TikZ 信号流图 | `handout.md` §3.1 Step 4 | 已生成 |
| h-09 | `md-09-example2-original.png` | 讲义 | TikZ 方框图 | `handout.md` §3.2 题目 | 已生成 |
| h-10 | `md-10-example2-step1.png` | 讲义 | TikZ 方框图 | `handout.md` §3.2 Step 2 | 已生成 |
| h-11 | `md-11-example2-step2.png` | 讲义 | TikZ 方框图 | `handout.md` §3.2 Step 3 | 已生成 |
| h-12 | `md-12-example2-step3.png` | 讲义 | TikZ 方框图 | `handout.md` §3.2 Step 4 | 已生成 |
| h-13 | `md-13-example2-labeled-block.png` | 讲义 | TikZ 方框图 | `handout.md` §3.2 Step 5 前 | 已生成 |
| h-14 | `md-14-example2-sfg.png` | 讲义 | TikZ 信号流图 | `handout.md` §3.2 Step 5 | 已生成 |
| h-info | `info.png` | 讲义末尾占位 | 空白占位图 | `handout.md` 总结后、附录前 | 已生成 |
| ic-01 | `intro-video.mp4` | 课堂 / 互动课导入 | 中文视频提示词 | 后续互动课首页或课堂开场 | 待生成 |

---

## 静态图片生成说明

本课正式静态图统一由脚本生成：

```bash
python3 course-content/authoring/lessons/2-1/media/raw/generate_media.py
```

说明：

- `info.png` 当前按用户要求只生成空白占位图。
- `md-02` 至 `md-14` 全部通过 TikZ 线框图流程生成。
- 本轮不再生成 `cover-comic.png`，讲义封面只保留提示词方案。

---

## 封面漫画提示词

仅保留中文定稿提示词，不在本轮生成图片文件。

- 文件：`media/raw/cover-comic-prompt.md`
- 用途：后续在即梦或其他中文文生图平台直接生成
- 注意：当前学生版讲义不插入封面占位图，等成图后再按需回写

---

## 即梦导入视频提示词

本课默认保留 15 秒导入视频规划，用于课堂开场或互动课首页。当前先交中文提示词，不在本轮生成视频文件。

- 文件：`media/raw/intro-video-prompt.md`
- 目标平台：即梦
- 已选唯一风格：`2.5D 工程动态信息图`

画面目标不是复述讲义，而是用“船舶航向偏差 -> 微分方程出现 -> 拉氏变换切换 -> 结构图成形”的动态过程，建立“为什么要学这一讲”的问题意识。

---

## 交付流程

1. 当前导出学生版 PDF 时，直接使用 `media/processed/` 中已有静态图。
2. 封面漫画后续只需根据 `cover-comic-prompt.md` 生成成图，再决定是否插回讲义。
3. 即梦视频后续按 `intro-video-prompt.md` 生成，作为课堂开场素材接入。
4. 若还要继续压缩结构图布局，只需修改 `generate_media.py` 并重新运行同一命令。
