# 批量接入脚本独立审核

## 范围

本轮新增 promote.py、integrate-runtime.ts、retire.py、verify-consumption.ts、verify-http.ts。独立审核角色 independent-reviewer；未复审既有两批代码和未完成的卡片。

## Finding 裁决

1. **ACCEPT / P1：审核集合未与最终登记精确绑定。** 原脚本仅检查行数；现逐项比对已审清单、scope、既有24张及ledger的Canonical ID、card ID和正文hash。退役前比对实际ledger摘要、接入凭证、当前绑定manifest摘要及绑定hash。
2. **ACCEPT / P1：中断后无法续作。** 原脚本在指针切换后才记凭证，删除前凭证又被误当作完成。现先保存staged接入凭证，支持projection、sidecar、binding之间中断后续作；退役区分prepared/completed并保留完整恢复文件清单。

## 整改验证

- `verify-activation-recovery.cjs`：相同行数的未审替换被拒绝；projection已切、其他指针未切时成功续作。
- `verify-retirement-recovery.py`：部分删除后成功续作且保留完整恢复证据；激活后ledger漂移阻止删除；完成态重跑不覆盖证据。

上述测试在隔离fixture执行，未切换实际运行态。独立整改复核确认中断恢复项已关闭，发现退役范围仍读取可变 inventory，第一项尚未完整解决。

主线程据此重新检查跨阶段共同约束：已审范围必须固定到接入凭证，后续导出、激活、退役和消费验证不可各自决定范围。现接入凭证固定 inventoryDigest 与 batchCanonicalIds；激活复用、退役、消费验证均检查该范围，promote也提前检查scope及审核键集合。新增“仅把inventory改为空但保持ledger不变”的反例通过，退役拒绝执行。

**裁决：两项已接受缺陷均已有修复和直接回归证据。** 按一次独立整改复核上限，最后的范围固化修复由主线程验证，未宣称另获独立无问题结论。本文件不代表卡片内容审核已通过。
