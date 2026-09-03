# Design

## 现状传播路径（已核实）

```
用户问题
  ├─ classifyKonlingAnswerIntent（generic-chat 关键词分类，规范词优先）
  ├─ hasIndependentNormativeRisk（独立正则/词表，弱于分类器）   ← 根因 2
  └─ buildKonlingStudyQuestionContract
       └─ normativeGuidance = verification-required（无权威引用时）
            ├─ ai-prompt-builder 一行提示                      ← 唯一执行机制
            └─ 最终回答后处理：仅剥离未核验引用标记              ← 根因 1
                 └─ 模型不遵守提示（66.7%）→ 不安全断言直达学生
```

契约层复核：冻结 120 例上意图准确率 100%，规范题 20/20 进入 `verification-required`，非规范题 0 误触发。因此修复重心在回答层执行与检测词表对齐，不改动分类顺序。

## 方案

### 1. 统一规范风险词表

抽出共享常量 `KONLING_NORMATIVE_QUERY_MARKERS`（法律、法条、法规、官方规定、官方要求、官方限值、国家标准、行业标准、标准格式、规范格式、规范书写、国标格式、考核办法、操作规程、认证、必须写、才算合格、化学方程式…）。`classifyGenericStudyQuestionIntent` 与 `hasIndependentNormativeRisk` 共用同一词表；独立检测器继续叠加标准编号正则与义务句式正则。效果：`resource-coach` 等回退 `fact-explanation` 的模式下，标准问法经独立检测器触发 `verification-required`。

### 2. 回答层合规扫描（守卫内计算）

`buildKonlingCitationGuard` 在 `studyQuestion.normativeGuidance === 'verification-required'` 且传入 `assistantMessage` 时计算：

```ts
normativeCompliance?: {
  status: 'compliant' | 'degraded';
  violations: Array<'unhedged-normative-assertion' | 'unverified-standard-identifier' | 'authority-link'>;
} | null
```

逐行扫描（跳过代码块，与 `scanKonlingAnswerUnits` 同口径）：

- **unhedged-normative-assertion**：行含权威词（法规/官方规定/国家标准/规范要求/标准要求/认证/规程/考核办法等）且含义务词（必须/不得/应当/严禁/禁止/务必/一定要/才算合格/要求），且该行不含限定词（需核验/待核验/无法核验/未能核验/未经核验/无法确认/不确定/通常/一般/可能/原则上/请以…为准等）。
- **unverified-standard-identifier**：行命中标准编号正则（GB/T、ISO、IEC、IEEE、ASTM、EN 等）。`verification-required` 前置条件下守卫内不存在已核验 official-reference 引用，任何标准编号都无权威背书。
- **authority-link**：行含权威词或义务词且含 `https?://` 链接、无限定词——服务端未分配的权威链接。

流式预生成守卫（`buildKonlingStreamingCitationGuard`，无回答文本）不计算该字段。

### 3. 确定性降级

```ts
export function applyKonlingNormativeSafetyDegradation(
  assistantMessage: string,
  guard: KonlingCitationGuard,
): string
```

`normativeCompliance.status === 'degraded'` 时整体替换为服务端模板：无法核验声明、证据缺口（缺服务端已核验官方标准文本/法规条款/课程正式规定）、可回答边界（规范效力/条款/编号/强制要求结论未经核验，不得作为规范依据）、核验建议（以课程正式文本、教师确认要求或官方渠道为准，可改问一般原理）。模板自身不含任何权威断言、标准编号或链接，故交付文本的不安全断言率按构造为 0。

合规或非 `verification-required`（含 `verified`）时原样返回——有权威来源的正常回答不受影响，非规范问答完全不受影响。

选择「整体替换」而非「逐句改写」：逐句改写模型散文不可判定且易绕过（换一种义务措辞即漏），整体替换是唯一可确定性证明 ≤5% 门禁的方案；首过合规的回答（提示已要求需核验框架）原样保留，一般原理解释在合规回答中得以保留。

### 4. 接线

- `src/app/api/ai/chat/route.ts` `buildFinalCitationGuardOutcome`：`body: applyKonlingNormativeSafetyDegradation(stripUnverifiedKonlingCitationMarkers(...), guard)`，finalize 与 optimization 两条调用点共用该闭包。
- `src/app/api/ai/sessions/[id]/messages/route.ts`：`applyKonlingCitationFallback` 之后叠加降级。
- 元数据：`buildCitationGuardMetadataPayload` 与 messages 路由守卫元数据补充 `normativeCompliance`；流式草稿→最终修订的既有可见流程不变（与未核验引用标记剥离同模式）。

### 5. 回归集与测试

- 新冻结集 `src/lib/konling-normative-status-cases.json`：每例 `{ id, phrasing, query, expectedStatus }`，phrasing 覆盖 standard / implicit / multi-intent / standard-identifier / obligation / negative。负例（课程普通词汇「标准」如「什么是标准传递函数」）期望 `not-applicable`，防止一律拒答。
- 测试 `konling-normative-runtime-safety-1901.test.ts`：
  1. 状态混淆矩阵：准确率 ≥90%、`verification-required` 召回 ≥90%、负例不误触发；
  2. `resource-coach` 回退意图下标准问法仍进入 `verification-required`（词表对齐回归）；
  3. 罐装不安全回答（官方必须/规范要求/虚构 GB 编号/权威链接）经降级后不含任何违规类 → 不安全断言率 0；
  4. 合规回答（需核验框架）与 `verified` 路径原样通过；
  5. 客户端自报核验/提示注入不能提权（沿用 #1818 fixture 模式扩展到回答层）；
  6. 两路由源码接线断言（沿用 `ai-chat-route-runtime-guard.test.ts` 先例）与 prompt 行存在性。

## 风险与取舍

- **误替换**：合规回答被误判降级会损失内容。缓解：违规判定要求「权威词 + 义务词 + 无限定词」同行共现，模板要求的需核验框架天然带限定词；冻结集测试锁定误报率。
- **词表盲区**：义务词/权威词枚举不可能穷尽。这是提示层已存在的问题；确定性层的职责是兜住已枚举的高危表达并使指标可测，新表达按回归样本滚动补充。
- **流式中间态**：流式期间学生可能短暂看到未降级草稿；与既有引用标记剥离、修订流替换同一可见模式，最终持久化与修订体均为降级后文本。
