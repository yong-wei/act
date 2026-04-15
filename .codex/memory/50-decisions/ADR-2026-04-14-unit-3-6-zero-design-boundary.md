# ADR-2026-04-14：3-6 承担零点设计的预先展开

状态: active
最后更新: 2026-04-14
摘要: `3-6（实践） 零点作用与动态改善实验` 不再只承担四版本对照与风险识别，还正式承担零点设计的预先展开：允许在统一对象上完成 `PD`、测速反馈、简单超前与非最小相边界的参数化设计、跨域验收与附录级保守示例；模块4主要接整体设计理念、约束排序与多目标权衡，不再假定这里还有充足空间重新展开整条零点设计链。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/50-decisions/00-index.md)
- [../40-domain/10-lesson-framework.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/40-domain/10-lesson-framework.md)
下游: []
相关:
- [course-content/authoring/lessons/3-6/design/handout.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/lessons/3-6/design/handout.md)
- [course-content/syllabus-refactor/module-skeletons.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/module-skeletons.md)
- [course-content/syllabus-refactor/unit-design-details/module3.md](/Users/YW/Documents/Site/act.just.edu.cn/course-content/syllabus-refactor/unit-design-details/module3.md)

## 结论

- `3-6` 现在允许保留并正式承载以下内容：
  - 时域目标到目标极点区域的翻译；
  - `PD` 与测速反馈的参数化求解与阶跃验收；
  - 简单超前与同指标下 `PD` 的频域设计、`Bode` 验收与时域回查；
  - 右半平面零点的边界重审，以及附录级保守设计示例。
- `3-6` 仍不承担模块4的主任务：
  - 约束排序；
  - 多目标权衡；
  - 整体方案选型与优化哲学；
  - 多场景综合设计组织。

## 触发原因

- 原 `3-6` 边界被压缩为“统一对象四版本对照 + 风险提醒”后，`PD`、测速反馈、超前和非最小相的完整设计链被挤出。
- 模块4当前更强调整体设计理念与任务书、约束、排序、权衡的系统组织，无法再为零点设计留出充足篇幅重走整条参数化求解主线。
- 若不在 `3-6` 预先展开零点设计，学生会在模块3只见机理、不见可计算设计链；到模块4又直接跳入整体设计，形成认知断层。

## 落地方式

- 学生版讲义恢复到“统一对象 + 目标驱动设计链 + 四版本比较 + 非最小相附录”的完整形态。
- `module-skeletons.md` 中把 `3-6` 的主要任务改为“统一对象下的零点设计预展开”。
- `module3.md` 中删除“`3-6` 不做精确参数计算推导 / 不扩展成完整设计实践”的旧限制，改为“允许参数化预展开，但不进入模块4的整体方案优化”。

## 对后续制作的影响

- 后续若继续修订 `3-6` 的 `boppps.md`、`interactive-page.md`、教师讲义或媒体清单，应默认以“目标翻译 -> 参数求解 -> 跨域验收 -> 比较 -> 非最小相边界/附录”为正式主线。
- 后续若修订模块4，不能再把零点设计基础内容整体挪回模块4；模块4应承接为“在已掌握零点设计链的基础上，进入整体设计理念与权衡”。
