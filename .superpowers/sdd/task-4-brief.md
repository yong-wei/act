# Task 4: Motion and Inspector Behavior

Implement OpenSpec tasks 4.1–4.4.

- Add bounded focus dimming, center-to-neighbor edge reveal, staged node appearance (individual stagger capped at 24, larger shard batched), bounded collapse, safe local viewport translation, and stale-transition cancellation. No full fit-to-view or continuous expansion motion.
- Implement `prefers-reduced-motion`: same final focus/loading/expanded/collapsed/error state without spatial interpolation, stagger, edge drawing, or animated semantic particles; static direction remains.
- Close inspector on blank canvas activation, canvas drag start, node drag start, and expandable-node activation without changing expansion/cache/viewport/coordinates.
- Reorder desktop/mobile inspector: identity/explanation, Knowledge Card, Related Knowledge Points, then learning-path/evidence/actions.

Use design timing bounds: focus 140–180ms, relation 180–240ms, total reveal <=360ms, local camera 220–280ms. Transitions keyed by graphVersion/target/generation and cancelled by newer activation, collapse, filter/version change, or unmount. Preserve Task1–3 contracts. TDD; run focused tests/typecheck/touched ESLint/OpenSpec strict/diff-check; check 4.1–4.4 only; commit locally, no push/GitHub; report `.superpowers/sdd/task-4-report.md`.
