## 1. Scope And Baseline

- [x] 1.1 Depend on the React Doctor warning baseline evidence.
- [x] 1.2 Extract current diagnostics for accessibility and DOM semantics rule families.

## 2. Remediation

- [x] 2.1 Add explicit button types to owned-surface buttons without changing form submit semantics.
- [x] 2.2 Associate visible labels with inputs, selects, textareas, and custom controls.
- [x] 2.3 Convert static clickable elements to semantic buttons or add equivalent keyboard behavior.
- [x] 2.4 Add captions or explicit accessibility exceptions for owned video/media surfaces, including owner/removal notes for dynamic media without caption URL fields.

## 3. Validation

- [x] 3.1 Run focused component/unit tests for changed shared controls where available.
- [x] 3.2 Add or run targeted form submit and keyboard-equivalence regression checks for changed buttons, labels, and static interaction surfaces.
- [x] 3.3 Run owned-surface React Doctor warnings and prove targeted rule counts decreased or reached zero for the touched scope.
- [x] 3.4 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [x] 3.5 Run `rtk openspec validate fix-owned-surface-a11y-dom-warnings --strict` before archive, then verify archived state with `rtk openspec validate owned-surface-accessibility-semantics --strict` and `rtk openspec validate --changes --strict`.
