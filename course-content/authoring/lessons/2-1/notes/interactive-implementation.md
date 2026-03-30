# 2-1 互动课程实现记录

更新时间：2026-03-30

## 本轮实现范围

- 新增主线精品互动课路由：`/interactive-learning/courses/unit-2-1-modeling-language`
- 补齐教师端 `/teacher/[sessionId]` 与学生端 `/student/[sessionId]`
- 新增 `unit-2-1-modeling-language-v1` 预置教案与课程目录卡片
- 在 `src/lib/course-ai-contexts.ts` 中注册 `2-1` 的步骤级 AI 上下文
- 会话标题识别仅保留 `2-1：建模与变换语言——从真实对象到统一分析对象` 新主线
- 旧 `1-1 / 1-2` 公开课程路由已删除，不再作为主线公开入口

## 运行时真源

- 统一从 `course-content/runtime/lessons/2-1/` 读取：
  - `lesson.json`
  - `graph-overlay.json`
  - `handout.md`
  - `review/*`
  - `media/*`

## 页面实现说明

- 总步数：16 步
- 首页：复用 `LessonEntryRuntimeSections`，直接展示 runtime 导学、知识图谱、知识卡与讲义入口
- 课堂页：
  - 顶部保留课程标题、阶段、时长、步骤切换与知识卡抽屉
  - 学生端保留首次跟随教师、后续不同步提示与手动跳转
  - 教师端保留课堂码、学生列表折叠、释放活动、显示答案与结束课堂
- 主要交互：
  - `step-02 / step-04 / step-15`：客观题判断与统计
  - `step-07`：对象项 / 初值项对照 + 页内 AI 对照
  - `step-08`：典型环节对象浏览器 + 识别作答
  - `step-09 / step-10`：结构连接规则与工程结构识别
  - `step-12`：梅森术语阅读器 + 配对作答
  - `step-13 / step-14`：闭环对象收束与 `Delta_k` 接触关系辨析

## 当前取舍

- 历史 `1-1 / 1-2` 课堂会话不做兼容迁移
- 旧公开 URL 不做跳转，按产品决策直接下线
- 旧 `1-1 / 1-2` 的课程定义与特性代码仍保留在仓库中作为历史实现参考，但不再被主线入口、预置教案或公开目录引用
