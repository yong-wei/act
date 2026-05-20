## Context

The foundation change lets the classic four-view preset render for both free exploration and Arena contexts. The remaining chart defects are visible in the shared workbench: time-domain curves can be visually compressed, reference input is missing from the plot, legend samples can disagree with actual lines, and correction-enabled frequency views lack an explicit source switch.

## Goals / Non-Goals

**Goals:**

- Compute time-domain y-axis bounds from the visible response and reference data with about 10% margin.
- Display the reference input as a dashed signal and keep legend samples synchronized with actual chart styles.
- Add correction-before/correction-after source switching for root-locus and Nyquist panels.
- Preserve one shared implementation path for free exploration and Arena contexts.

**Non-Goals:**

- Do not redesign the object selector or parameter drawer.
- Do not introduce new control algorithms or new object data.
- Do not change official Arena scoring or artifact generation.
- Do not remove the legacy direct multi-representation route.

## Decisions

1. Auto range uses all visible finite time-domain series, not a single corrected-output series.
   - Rationale: the displayed axis must fit what the student can see, including the reference signal.
   - Alternative considered: use only the maximum corrected output. That can hide uncorrected overshoot or make the reference line misleading.

2. Legend entries are derived from the same style tokens used by the rendered curves.
   - Rationale: separate legend styles caused the current color and line-type mismatch.
   - Alternative considered: patch individual legend labels. That would leave the mismatch easy to reintroduce.

3. Root-locus and Nyquist use explicit source selection when correction is enabled.
   - Rationale: root-locus should render one selected source at a time, and Nyquist should not silently choose corrected or uncorrected data.
   - Alternative considered: overlay all curves by default. That conflicts with the existing root-locus requirement and can obscure interpretation.

## Risks / Trade-offs

- Near-flat signals can produce too narrow a range. -> Enforce a small minimum span after computing the 10% margin.
- Source selection state can diverge between panels. -> Keep view-level state separate and initialize from the available view configuration.
- Browser-only chart assertions can be brittle. -> Pair targeted unit tests with one focused rendering check.
