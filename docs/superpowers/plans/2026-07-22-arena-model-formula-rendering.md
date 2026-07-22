# Arena Model Formula Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Arena model-selector transfer functions as professional inline mathematics without changing model or selection semantics.

**Architecture:** Add a file-local model formula renderer to `ArenaModelSelectorPanel`. It consumes the existing `TransferFunctionModel`, selects `InlineMath` for authored LaTeX, and preserves the plain display fallback.

**Tech Stack:** React, TypeScript, react-katex, KaTeX, Vitest, Testing Library

## Global Constraints

- Reuse the existing `react-katex` and KaTeX dependencies.
- Do not change transfer-function data, compatibility rules, evaluation, persistence, or APIs.
- Preserve the plain `display` fallback when `latex` is absent.

---

### Task 1: Model Selector Formula Rendering

**Files:**
- Modify: `src/features/arena/workbench/arena-model-selector-panel.tsx`
- Create: `src/features/arena/__tests__/arena-model-selector-panel.client.test.tsx`

**Interfaces:**
- Consumes: `TransferFunctionModel` and the existing `ArenaModelSelectorPanel` props.
- Produces: file-local formula presentation and unchanged `onSelectObject(objectId: string)` behavior.

- [ ] **Step 1: Write the failing component test**

Render the locked second-order model and assert `.katex .msupsub` exists while literal `s^2` does not. Render an unlocked selector, temporarily supply a display-only model through the seed array, assert its display is visible, and click a compatible model to assert `onSelectObject` receives its id.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/arena/__tests__/arena-model-selector-panel.client.test.tsx`

Expected: FAIL because the selector exposes literal `s^2` and produces no KaTeX superscript markup.

- [ ] **Step 3: Implement the minimal renderer**

Import `InlineMath`, the KaTeX stylesheet, and `TransferFunctionModel`. Add a file-local component that returns `<InlineMath math={model.latex} />` when LaTeX exists and the plain `model.display` otherwise. Replace both direct `model.display` render sites with this component.

- [ ] **Step 4: Run focused and related tests**

Run: `npx vitest run src/features/arena/__tests__/arena-model-selector-panel.client.test.tsx src/features/arena/__tests__/arena-domain.test.ts`

Expected: both test files pass with zero failures.

- [ ] **Step 5: Complete repository verification**

Run: `npm run typecheck`

Run: `npx --yes openspec validate render-arena-model-formulas --strict`

Run: `git diff --check`

Expected: every command exits with status 0.

- [ ] **Step 6: Commit the implementation**

Stage only the component, focused test, and completed OpenSpec task/archive files. Commit with `fix(arena): render model formulas professionally`.
