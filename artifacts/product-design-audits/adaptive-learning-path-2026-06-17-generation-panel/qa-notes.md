# Adaptive Path Generation Panel QA

Change: `redesign-adaptive-path-generation-panel`
Date: 2026-06-17

## Approved Visual Sources

- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png`
- `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png`

## Captures

- URL: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation&demo=1&scene=generate`
- Desktop: `artifacts/product-design-audits/adaptive-learning-path-2026-06-17-generation-panel/01-generation-panel-desktop.png`
- Mobile: `artifacts/product-design-audits/adaptive-learning-path-2026-06-17-generation-panel/02-generation-panel-mobile.png`

## Probe Output

```text
01-generation-panel-desktop.png: editable=true explainButtons=6 engineeringLeakCount=0
02-generation-panel-mobile.png: editable=true explainButtons=6 engineeringLeakCount=0
```

## SHA-256

```text
913ab43220e9c6fbadedd5d3a92be60dafcec6ccd0efc0db7e72986b8663e52b  01-generation-panel-desktop.png
c6f8309bbd4237f3edbdbe2ef7a4121296893aed511faa97ff9bba501a252b10  02-generation-panel-mobile.png
```

## Checks

- Generation panel is editable and includes goal, time budget, difficulty rhythm, resource preferences, checkpoint density, external resources, and natural-language intent.
- Shared Konling dock remains separate from the generation panel.
- Path comparison shows resource mix, readiness, checkpoints, expected result, and risk note.
- Desktop and mobile captures reported editable textarea.
- Student-visible page text did not match `Konling parameters`, `policyBundle`, `foundation-remediation`, or `stage-1-rules-graph`.
