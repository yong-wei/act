## 1. Restore pre-hydration theme initialization

- [x] 1.1 Restore `buildThemeInitScript()` in `src/lib/theme-config.ts` so it uses the same rules as `resolveInitialTheme`, interpolates only the storage key and a validated `light`/`dark` default, and wrap failures in `try/catch`
- [x] 1.2 Inject the audited `<script id="theme-init">{buildThemeInitScript()}</script>` in the root layout head, omit React-owned `className="dark"`, and verify `scripts/tests/test-theme-toggle.ts` plus the React Doctor security surface test pass
- [x] 1.3 Make `ThemeProvider` re-resolve from storage/system preference on mount before applying or persisting theme, so SSR default `dark` cannot overwrite stored `light`

## 2. Tests and browser regression

- [x] 2.1 Extend the theme contract test so the generated script applies class and `color-scheme`, rejects invalid stored values, and `src/app/layout.tsx` still references `#theme-init`
- [x] 2.2 Keep `tests/theme-init-script.spec.ts` covering stored light/dark and system fallback at desktop and 320px, asserting `#theme-init` exists and the root matches at `domcontentloaded`
- [x] 2.3 Add Playwright coverage for login success and sign-out document navigations with stored `light` and stored `dark`, asserting first-document theme without changing auth behavior

## 3. Validation

- [x] 3.1 Run `npm run test:theme`, focused Playwright theme specs, and `npx tsc --pretty false --noEmit` or `npm run typecheck` on the changed files, then `openspec validate fix-theme-first-frame-flash --strict`
