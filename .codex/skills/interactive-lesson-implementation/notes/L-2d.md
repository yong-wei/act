# L-2d 课程实现笔记

## 课程信息
- 课次：L-2d
- 标题：三域联动探索——平台操作初体验
- 当前设计源：
  - `course-content/authoring/lessons/legacy/L-2d/design/L-2d-interactive-page.md`
  - `course-content/authoring/lessons/legacy/L-2d/design/L-2d-practice-guide.md`
  - `course-content/authoring/lessons/legacy/L-2d/design/L-2d-assessment-spec.md`
  - `course-content/authoring/lessons/legacy/L-2d/design/L-2d-boppps.md`

## 任务模式
- 模式：现有课程核对与收尾
- 参考样板：
  - `L-2c`：runtime 首页与知识卡接线
  - `L-2b`：实践课双端结构与工作区节奏

## 设计差异与约束
- 首页讲义源不是常规 `handout.md`，而是 `practice-guide.md`。
- 本课为实践课，核心资源是前端三面板工作区，不依赖外部静态媒体；`interactive-page.md` 末尾也明确“所有资源均为前端绘制”。
- 所有验收标准以 `assessment-spec.md` 为准：
  - OBS-01：临界增益评分
  - OBS-02：四行三域对照表评分
  - OBS-03：反思提交评分
- 课程运行时必须只依赖 `course-content/runtime`：
  - 首页知识图、知识卡、讲义入口均走 runtime
  - 讲义导出后应保留 Markdown 原文并重写媒体路径

## 当前实现判断
- 已存在 `L-2d` 课程实现骨架与 runtime 产物，但当前工作区尚未提交：
  - `course-content/runtime/lessons/legacy/L-2d/{lesson.json,graph-overlay.json,handout.md}`
  - `src/lib/l2d-course.ts`
  - `src/features/interactive/l2d-three-domain-linkage/*`
  - `src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/*`
  - `src/features/teacher/preset-lessons/presets/l2d-three-domain-linkage-practice.ts`
  - `scripts/tests/test-l2d-*.ts`
- 已接通的能力：
  - 首页 runtime 导学区、知识点网络、知识卡片预览、讲义入口与 PDF 导出入口
  - 教师/学生双端课堂页
  - 步骤知识卡抽屉
  - 三面板联动工作区（根轨迹 / 时域 / Bode）
  - 任务一、任务二、任务三即时评分与学生端成绩汇总
  - 教师端前测统计、任务一/任务二汇总、反思词云、后测区间回看、在线人数折叠与结束课堂

## 媒体结论
- `interactive-page.md` 明确 4 个资源均为“前端绘制”：
  - R-1 知识图谱定位图
  - R-2 三面板联动工作区
  - R-3 K 值分布直方图
  - R-4 任务二即时反馈检验展示
- 因此本轮不需要新增静态图片或视频文件，但需要保证页面运行时组件能在仅有 runtime 数据时正常工作。

## 计划中的实现骨架
- `src/lib/l2d-course.ts`：课程元数据、14 步配置、评分结构、学生状态
- `src/features/interactive/l2d-three-domain-linkage/*`：入口页、教师页、学生页、步骤面板、三面板工作区
- `src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/*`：课程路由
- `course-content/scripts/export_runtime.py`：支持 `practice-guide.md -> runtime/<lesson>-handout.md`

## 最新核对结论（2026-03-14）
- 设计稿与实现稿的主干已基本对齐：
  - 14 步步骤标题、顺序与主要活动类型齐备
  - `practice-guide.md -> runtime/<lesson>-handout.md` 已导出
  - `lesson.json` 与 `graph-overlay.json` 已存在
  - `L-2d` 路由、课程目录卡片、预设课与课堂码路由解析已挂接
  - 本轮已补齐“互动课程 -> 精品课程”入口过滤，`l2d-three-domain-linkage-practice` 会出现在精品课程分组
  - 本轮已把精品课浅色模式面板填充统一收口到 `src/app/globals.css` 主题变量，不再依赖模块内硬编码颜色
  - 本轮已补充教师端/学生端浏览器验收子代理规范文件，供主代理分角色下发
- 定向验证结果：
  - `node scripts/tests/test-l2d-course-registration.ts` 通过
  - `node scripts/tests/test-l2d-entry-runtime-content.ts` 通过
  - `node scripts/tests/test-l2d-runtime-export.ts` 通过
  - `node scripts/tests/test-l2d-workspace-and-assessment.ts` 通过
  - `npm run lint` 通过
  - `npm run build` 通过，构建产物已包含 `l2d-three-domain-linkage-practice` 入口、教师页、学生页
- 本轮补修：
  - 修复 `scripts/tests/test-l2d-runtime-export.ts` 的 ESM 路径解析问题
  - 顺手同步修复 `scripts/tests/test-l2c-runtime-export.ts` 的同类问题

## 浏览器闭环状态
- 单浏览器快速核对已确认：
  - 首页入口顺序正确（教师入口 / 自由浏览 / 学生入口）
  - 首页 runtime 模块可见（知识点网络、知识卡预览、讲义入口）
  - `student/demo` 可进入第 1 步并显示 14 步导航
- 双子代理真实课堂闭环验收结果：
  - 教师端 bootstrap：通过
    - 登录、建课、课堂码显示、在线学生区默认折叠均通过
    - 本轮课堂码：`127241`
  - 学生端 bootstrap：通过
    - 登录、入口待命、课堂码输入框可见均通过
  - 学生端真实课堂闭环：
    - 加入课堂成功
    - `step-01` ~ `step-03` 通过
    - `step-04` 前测提交通过；答案揭示在教师补测后完成闭环
    - `step-05` ~ `step-06` 通过
    - `step-07` 任务一提交通过
    - `step-08` ~ `step-09` 通过
    - `step-10` 任务二第 1 行提交通过
    - `step-11` 通过
    - `step-12` 反思提交通过
    - `step-13` 区间提交通过
    - `step-14` 在教师结束课堂后可回到成绩概览
    - 跟页机制通过：出现“当前页面与教师不同步，点击跳转”提示后可正确跳到教师当前页
  - 教师端关键互动闭环：
    - `step-04` “显示答案”通过
    - `step-07` 任务一监控通过
    - `step-10` 任务二监控通过
    - `step-12` 词云与默认折叠回复列表通过
    - `step-13` 后测区间回看通过
    - `step-14` 结束课堂通过
- 浏览器验收中的环境问题与处理：
  - 初次用 standalone 服务时，`.next/standalone/.next/static` 缺失，导致 `/_next/static/*` 404，页面只渲染 SSR HTML、未完成 hydration
  - 修复方式：补齐 standalone 静态资源后再进行双子代理验收
  - `window.confirm` 会阻断“结束课堂”自动点击，浏览器验收时必须显式处理页面对话框
  - 本轮未遇到浏览器层“弱密码/保存密码”弹窗，但后续验收仍应将其视为潜在阻塞源

## 基线情况
- 当前仓库主工作区存在未提交改动，除 `L-2d` 外还包含 `L-2c` runtime 化与知识图谱相关文件。
- 为避免误覆盖，本轮只做最小化补修与验收，不回退现有未提交实现。
- `npm run build` 期间出现若干既有 API 的 `DYNAMIC_SERVER_USAGE` 日志，但构建成功；暂未发现它们阻断 `L-2d` 上线。
- 当前已知无 `L-2d` 阻断上线缺陷；剩余风险主要在后续复用 standalone 浏览器验收时，需先确保 `.next/standalone/.next/static` 已同步。
