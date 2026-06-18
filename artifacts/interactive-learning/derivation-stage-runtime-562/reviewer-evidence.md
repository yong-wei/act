# Derivation Stage Runtime Reviewer Evidence

The shared `visual.derivationStage` runtime is exercised by `/review/derivation-stage-runtime-562`.

Acceptance focus:

- Formula rendering is backed by KaTeX output and retained LaTeX source attributes.
- Reveal state is target-id driven, not DOM-order or vertical-list driven.
- Formula blocks expose semantic color roles for local emphasis.
- Teacher diagnostics are rendered outside the primary stage and do not expose student input controls.
- Student submitted evidence preserves active reveal step, max reveal step seen, visited reveal steps, focused formula blocks, answer fields, feedback fields, and server-trusted source log fields.
