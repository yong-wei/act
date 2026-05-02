# 3-2 互动课程实现对照

## 本轮目标

- 以 `design/3-2-interactive-page.md` 与 `design/3-2-interactive-contract.yaml` 为真源，整改 3-2 runtime 到新版 13 步合同。
- 保持“双卡独立提交、正文在前作答在后、发放作答 / 开放浏览 / 逐行显影推进 / 参考答案分离”。

## 真源与实现落点

| 步骤 | 设计稿标题 | runtime 实现 | 当前状态 | 验证要点 |
| --- | --- | --- | --- | --- |
| `step-01` | 回到地图——从纯极点语言走向稳定边界 | `src/lib/unit-3-2-course.ts` `step-panels.tsx` | 已对齐 | 无作答区、仅地图与任务卡 |
| `step-02` | 先看主对象——一般化特征方程为什么先于图像判断 | `unit-3-2-course.ts` `step-panels.tsx` | 已对齐 | 一般化特征方程、三问与二选一保持同页 |
| `step-03` | 前测——不求根判稳、特殊情况与区域收紧 | `unit-3-2-course.ts` `step-panels.tsx` | 已对齐 | 三题同页、独立作答 |
| `step-04` | 普通劳斯表——固定 `k=4` 时怎样从第一列读出稳定性 | `step-panels.tsx` `student-page.tsx` `teacher-page.tsx` | 已整改 | 题面常显、显影链、双卡独立提交 |
| `step-05` | 带参数劳斯表——稳定区间怎样从第一列条件链中写出 | 同上 | 已整改 | 条件链在前、区间卡与漏条件卡分离 |
| `step-06` | 边界点回到复平面——`k=-2`、`18`、`22` 分别对应什么根结构 | 同上 | 已整改 | 参数表、主图、双卡同页 |
| `step-07` | 首位为 0——`ε` 连续化为什么只服务于符号判断 | 同上 | 已整改 | 教师显影、右半平面根数卡、`ε` 作用卡 |
| `step-08` | 全零行——辅助方程怎样把对称根结构重新写出来 | 同上 | 已整改 | 规则卡、显影链、双卡分离 |
| `step-09` | 劳斯现象到时域——极点结构怎样改写响应形态 | 同上 | 已整改 | 先表后图，再双卡 |
| `step-10` | 劳斯现象到频域——峰值抬高、理想共振与低频抬升如何区分 | 同上 | 已整改 | 公式卡、Bode 图、双卡同页 |
| `step-11` | 变量平移——把 `Re(s)<-0.5` 转成普通劳斯判定 | 同上 | 已整改 | 平移链显影、新旧区间对比、双卡分离 |
| `step-12` | 后测——判稳、特殊情况与区域约束能否连成一条链 | `unit-3-2-course.ts` `step-panels.tsx` | 已对齐 | 后测独立成页 |
| `step-13` | 收束——从稳定判定走向参数设计入口 | `unit-3-2-course.ts` `step-panels.tsx` | 已对齐 | 无作答区、保留总结面板 |

## 关键文件

- 课程真源：`course-content/authoring/lessons/3-2/design/3-2-interactive-page.md`
- 机读合同：`course-content/authoring/lessons/3-2/design/3-2-interactive-contract.yaml`
- runtime 课程：`src/lib/unit-3-2-course.ts`
- AI 上下文：`src/lib/unit-3-2-ai-contexts.ts`
- 页面实现：`src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx`
- 师生页面：`src/features/interactive/unit-3-2-routh-stability-boundary/student-page.tsx` `src/features/interactive/unit-3-2-routh-stability-boundary/teacher-page.tsx`
- 严格审查入口：`course-content/scripts/review_lesson_content.py`

## 验证命令

```bash
rtk npm run test:unit -- src/features/interactive/__tests__/unit-3-2-course.test.ts
rtk npm run test:unit -- src/features/interactive/__tests__/unit-3-2-remediation.test.ts
rtk python3 course-content/scripts/review_lesson_content.py --lesson 3-2 --strict-implementation-contract
```

## 本轮整改补记

- 学生页与教师页已移除页内 AI 入口，快捷提问仅保留在隐藏式控灵页面上下文中。
- `step-02` 已回到引入章节口径，固定对象改为一般化特征方程，问题链同步改为“稳定性、右半平面根数、边界根结构”。
- `step-06`、`step-09`、`step-10` 现统一为学科语言下的动态分析面板，分别对应复平面边界判读、时域响应对照与频域迹象对照。
- `step-02`、`step-08`、`step-09`、`step-10`、`step-11` 不再依赖静态图片承载核心知识。
- `step-04`、`step-05`、`step-07`、`step-08`、`step-11` 的显影链已改为真实步骤内容，并支持“点击当前最下方已显影行继续展开下一行”。
- 本轮接受记录写入 `design/interactive-design-acceptance.json` 与 `notes/interactive-implementation-acceptance.json`，供严格审查脚本读取。
