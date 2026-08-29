## Purpose

保证用户已保存的浅色或夜间主题在新文档首次绘制时就已经生效，避免水合前用错误主题闪一帧，并在登录与退出登录跳转中保持同一契约。

## ADDED Requirements

### Requirement: First paint uses the resolved stored or system theme

The application SHALL resolve the document theme before the first paint of a new document from the existing `ai-obe-theme` storage value, then the system color-scheme preference, then the existing default theme rule. The document root SHALL contain exactly one of `light` or `dark`, and `style.colorScheme` SHALL match that class.

#### Scenario: Stored light theme on cold start or hard refresh

- **WHEN** `ai-obe-theme` is `light` and the user opens or hard-refreshes a page that uses the root layout
- **THEN** the first painted frame SHALL use the light theme
- **AND** the document SHALL NOT first paint with the night theme before switching to light

#### Scenario: Stored dark theme on cold start or hard refresh

- **WHEN** `ai-obe-theme` is `dark` and the user opens or hard-refreshes a page that uses the root layout
- **THEN** the first painted frame SHALL use the dark theme
- **AND** the document SHALL NOT first paint with the light theme before switching to dark

#### Scenario: Missing stored theme follows system preference

- **WHEN** theme storage is empty and the system color-scheme preference is light or dark
- **THEN** the first painted frame SHALL use that system preference
- **AND** the document root SHALL have exactly one matching theme class and matching `color-scheme`

#### Scenario: Script failure falls back to the default theme

- **WHEN** pre-hydration theme initialization cannot read storage or system preference
- **THEN** the document SHALL apply the existing default theme
- **AND** it SHALL still set exactly one theme class and a matching `color-scheme`

### Requirement: Auth document navigations keep the same first-frame contract

Login success and sign-out navigations that render a new document SHALL use the same first-frame theme contract as cold start. Authentication, redirect targets, and existing navigation behavior SHALL remain unchanged.

#### Scenario: Login success navigation with stored light theme

- **WHEN** `ai-obe-theme` is `light` and the user completes login that navigates to a new document
- **THEN** the destination document's first painted frame SHALL use the light theme
- **AND** login behavior and the destination route SHALL remain unchanged

#### Scenario: Sign-out navigation with stored light theme

- **WHEN** `ai-obe-theme` is `light` and the user signs out in a way that navigates to a new document
- **THEN** the destination document's first painted frame SHALL use the light theme
- **AND** sign-out SHALL still land on the existing login destination

### Requirement: First-frame correction MUST NOT mask paint or change persistence

The application MUST NOT hide the whole page, delay showing main content, or add a full-screen overlay to conceal a wrong first frame. Theme persistence SHALL remain the existing client `ai-obe-theme` key. After hydration, client theme application SHALL NOT overwrite a valid stored theme with the server default night class.

#### Scenario: No concealment of a wrong first frame

- **WHEN** a new document is rendered
- **THEN** the implementation SHALL apply the resolved theme before first paint
- **AND** it SHALL NOT hide the document, delay body content, or introduce a full-screen loading mask to hide a theme mismatch

#### Scenario: Hydration does not clobber stored light theme

- **WHEN** `ai-obe-theme` is `light` and React hydrates the root layout
- **THEN** the document SHALL remain on the light theme
- **AND** the stored value SHALL remain `light`
