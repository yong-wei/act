# 平衡点与局部线性化六卡

本批范围固定为 `scope.json` 中 core-topic-03 的六个 v0.48 canonical 节点。六张作者卡分别承担线性化总览、切线几何、平衡雅可比、非平衡常项、小信号误差尺度、平衡与稳定区别六个教学任务；正文不把同一个例子仅换标题重复呈现。

卡片使用已捕获的 detail、neighborhood 和 previous authoring snapshot。immutable neighborhood 的对象、谓词与方向按来源顺序写入卡片；无邻接的卡片保留空的关联节点段落。`source_docs` 与 `source-inventory.json` 的真实路径逐字对应，未新增来源或历史卡片。

固定教学模型为无量纲系统 $\dot{x}=u-x^2$、静态关系 $g=x^2$，并按各卡任务使用已验算的工作点、输入、初态和有限时段。正文只展示四至六位有效数，完整浮点结果留在模型报告中。平衡点反例使用 $\dot{x}=-x^3$ 与 $\dot{x}=x^3$，用于说明零雅可比时一阶稳定性判断不足。

`verify-content.py` 会检查六个 scope/source identity、来源 SHA-256、真实 immutable neighborhood 关系、卡片结构、实际学习卡 parser、KaTeX 和已验算的固定模型报告，并生成 `inventory.json` 与 `numerical-verification.json`。验证只读取作者态与已捕获来源，不写 runtime、资源账本、目标或接入状态。

独立审核首次发现两项P1，修复后唯一受限复核PASS；接受状态与最终哈希见accepted-scope.json和review-acceptance.json。接入前另修复接受清单两项截短ID，未改变已审正文，详见review-findings.md。

## 本地消费验收

已接入v0.48-b16，累计121/121可执行卡、图谱检查器、实际路径选入、受保护页面及Markdown数学渲染通过；公式总计2974个，未知绑定端点和无效目标均0。新线性化目标主路径一次包含本批6张。浏览器验证平衡点泰勒级数线性化卡及自检，主线程已看图。

退役4项旧资源并删除8文件。16项目标/路径/选项测试与2项注册/动态目标边界测试通过，相关ESLint通过。未改变Authority快照、先修关系或学习事实，未发布服务器。

最终web/worker类型检查、OpenSpec strict及git diff --check通过。
