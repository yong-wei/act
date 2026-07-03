## Verification

- `rtk npm run test:unit -- src/app/__tests__/platform-entrypoints-smoke.test.ts`
  - 7 tests passed.
- `rtk git diff --check`
  - Passed.
- Browser visual QA against `http://localhost:3000/`
  - Captured:
    - `artifacts/visual-qa/refresh-home-brand-and-account-entry/desktop-light.png`
    - `artifacts/visual-qa/refresh-home-brand-and-account-entry/desktop-dark.png`
    - `artifacts/visual-qa/refresh-home-brand-and-account-entry/mobile-light.png`
    - `artifacts/visual-qa/refresh-home-brand-and-account-entry/mobile-dark.png`
  - Metrics:
    - `artifacts/visual-qa/refresh-home-brand-and-account-entry/homepage-brand-entry-visual-qa.json`
    - Desktop and 320px mobile states have `brandOverlapsProfile=false`, `brandOverlapsTheme=false`, `brandOverlapsMenu=false`, `bodyScrollWidth === viewportWidth`, and empty `clippedText`.
    - The metrics script filters by computed visibility before recording `visibleTopbarTexts`; the 320px mobile captures include the visible platform description, personal-center action, theme switch, and menu trigger.
    - Dark-theme logo treatment uses the shared lockup component's brightness, saturation, and drop-shadow enhancement.

## Notes

- The generated logo source is retained as `public/assets/platform-brand/deepblue-smart-control-logo-source.png`.
- The page consumes the final alpha PNG only through `src/components/shared/platform-brand-lockup.tsx`.
- The homepage product matrix renders directly from `homepageStudentEntries`, so it contains exactly 知识资源、互动学习、学习路径、竞技场、虚拟仿真、控制工作台.
- Mobile keeps a direct personal-center icon in the right action group and also includes the text entry inside the collapsed platform menu.
