# Commercial UI Evidence

该证据覆盖本变更实际触达的浏览器入口：互动课学生端、互动课教师端、图谱中心和学生作业工作台。

| 入口 | 1440px | 320px |
| --- | --- | --- |
| 学生互动课 | [截图](./interactive-student-desktop-1440.png) | [截图](./interactive-student-mobile-320.png) |
| 教师互动课 | [截图](./interactive-teacher-desktop-1440.png) | [截图](./interactive-teacher-mobile-320.png) |
| 图谱中心 | [截图](./graph-center-desktop-1440.png) | [截图](./graph-center-mobile-320.png) |
| 学生作业 | [截图](./student-assignment-desktop-1440.png) | [截图](./student-assignment-mobile-320.png) |

`manifest.json` 记录捕获时间、源码修订、生成器与生产源码 SHA-256、截图 SHA-256 及每个路由的几何和键盘焦点断言。捕获前后都会校验受跟踪源码、工作树和 HEAD 未漂移；截图与 manifest 仅在复核通过后写入。普通核验直接比对当前受跟踪源码与 manifest 中的 SHA-256，因此在浅克隆环境同样会在源码或截图漂移时失败。

捕获命令：

```bash
UPDATE_VISUAL_EVIDENCE=1 PLAYWRIGHT_CHANNEL=chrome npm exec -- playwright test tests/client-server-build-boundaries-commercial-ui.spec.ts --workers=1
```
