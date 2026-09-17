# 控制规律与串联校正七卡

独立领域审核：PASS，未发现 P0/P1 重大问题。范围与最终 SHA 见 content-review.md、review-acceptance.json。

已接入本地 v0.48-b12，累计 91 张。Authority 快照不变，七卡绑定当前 canonical ID。退役同节点旧资源 2 项，备份后删除作者态/runtime 共 4 文件。

verify-consumption.ts 验证累计 91/91 可执行、图谱检查器可读、被实际生成路径选入，91 张实际 Markdown 数学渲染通过，原始公式 2,190 个；未知绑定端点与无效目标均为零。路径测试使用内存学习者场景，不写入学习事实。

初次路径验证发现“比例积分控制器”和“补偿”无法被实际生成路径选入。已将二者加入现有 control-correction 学习目标，未改变先修关系，修复后 91/91 通过。

verify-http.ts 验证全部 91 个受保护资源页面；verify-browser.ts 验证图谱到串联滞后-超前校正卡及自检。路径相关 13 项测试通过。首阶段新增 67 张及原 24 张均完成本地消费验收；整个 458 张计划尚余 367 张。

未发布服务器。下一批 teaching-core-01a 六张建模基础卡正在制作，固定案例已从原方程验算。

补充验证：web/worker TypeScript 检查、接入与消费脚本 ESLint、OpenSpec strict 及 git diff --check 均通过。主线程已查看浏览器自检截图，公式与自检可见。
