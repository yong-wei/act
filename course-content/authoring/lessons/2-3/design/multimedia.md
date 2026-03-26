# 多模态资源设计 | 单元 2-3：频率响应基础

> **资源总数**：9 项
> **生成方式分布**：代码直出图 3 项，AI 位图 1 项，信息图 1 项，导入视频 1 项，生成式课件 1 项，课程视频 1 项，课程音频 1 项
> **当前状态**：讲义开头封面图、正文频率响应图、讲义末尾信息图以及课程级默认媒体均已落盘，命名统一采用 `2-3-...` 前缀。

---

## 资源总表

| 编号 | 文件名 | 用途 | 生成方式 | 引用于 | 状态 |
|:---:|:---|:---|:---|:---|:---|
| h-cover | `2-3-cover-comic.png` | 讲义开头封面图 | AI 位图 | `handout.md` 基本信息后 | 已生成 |
| h-01 | `2-3-fr-01-command-vs-disturbance.svg` | 讲义 | 代码直出图 | `handout.md` §1 | 已生成 |
| h-02 | `2-3-fr-02-square-wave-harmonics.svg` | 讲义 | 代码直出图 | `handout.md` §2 | 已生成 |
| h-03 | `2-3-fr-03-sine-in-sine-out.svg` | 讲义 | 代码直出图 | `handout.md` §2.3 | 已生成 |
| h-info | `2-3-info.png` | 讲义末尾信息图 | 位图 | `handout.md` 总结后、附录前 | 已生成 |
| ic-01 | `2-3-intro-video.mp4` | 课堂 / 互动课导入 | 中文视频提示词 | 后续互动课首页或课堂开场 | 已生成 |
| sh-slides | `2-3-slides.pdf` | 生成式课件 | PDF | 课件导出配套 | 已生成 |
| sh-course | `2-3-course.mp4` | 课程内容视频 | 视频 | 课堂播放 / 课后复习 | 已生成 |
| sh-audio | `2-3-audio.m4a` | 课程音频播客 | 音频 | 课后复习 | 已生成 |

---

## 静态图片与脚本

- `media/raw/2-3-fr-01-command-vs-disturbance.py` -> `media/processed/2-3-fr-01-command-vs-disturbance.svg`
- `media/raw/2-3-fr-02-square-wave-harmonics.py` -> `media/processed/2-3-fr-02-square-wave-harmonics.svg`
- `media/raw/2-3-fr-03-sine-in-sine-out.py` -> `media/processed/2-3-fr-03-sine-in-sine-out.svg`
- 相关验证与复现脚本继续放在 `media/raw/`，但正式导出图和讲义引用都统一使用 `2-3-...` 前缀

---

## 提示词文件

### 讲义封面漫画

- 文件：`media/raw/2-3-cover-comic-prompt.md`
- 成品：`media/processed/2-3-cover-comic.png`
- 用途：讲义基本信息后、正文前的导入封面图

### 即梦导入视频

- 文件：`media/raw/2-3-intro-video-prompt.md`
- 成品：`media/processed/2-3-intro-video.mp4`
- 用途：课堂开场或互动课首页导入

---

## 交付说明

1. 讲义 `handout.md` 现已统一引用 `2-3-...` 前缀媒体。
2. 后续若重生成封面、频率响应图或导入视频，继续覆盖同名成品文件，不再改讲义引用路径。
3. 若继续扩展互动课，可直接复用本目录中的正式成品媒体与提示词文件。
