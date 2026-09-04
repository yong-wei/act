## Why

2026-09-04 公开路径巡检（Issue #1935）发现站点对外品牌文案不一致：首页与 `<title>` 使用「智控深蓝」，但登录页（`src/app/(auth)/layout.tsx:20-21`）顶部仍显示旧品牌「AI-OBE船舶智控平台 / Mission Control for Maritime Education」，meta description 也保留旧产品线表述。用户在关键转化路径（登录）看到的品牌与主站割裂。

## What Changes

- 以「智控深蓝」为唯一对外主品牌名，登录页顶部品牌区改用主品牌与既有副标语体系。
- 清理用户可见表面（登录壳、导航副标题、meta description、邮件模板如有）中的旧品牌串「AI-OBE船舶智控平台」与英文 Mission Control 副标题；内部技术标识（数据治理域、provider 标识、代码内常量）不在本变更范围。
- 保留「AI-OBE」作为产品线/技术名时仅降级为关于页或文档语境的副文案，不再出现在登录、导航等主入口。
- 增加登录页与首页品牌一致性的契约测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `platform-commercial-brand-language`: 对外主品牌名统一为「智控深蓝」，登录与认证表面不再使用旧品牌串。

## Impact

- `src/app/(auth)/layout.tsx` 品牌区文案。
- 根布局 metadata description 的旧产品线表述统一。
- 其他含旧品牌串的用户可见表面（导航副标题、邮件模板如存在）。
- 品牌一致性契约测试。
- 不改动内部 `ai-branding.ts` 等技术域标识，不动视觉资产体系。
