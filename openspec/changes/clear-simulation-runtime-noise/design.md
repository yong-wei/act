## Context

The audit captured screenshots successfully, but every route produced the same page error and deprecation warnings. These errors reduce confidence in visual QA because the browser may be rendering through a broken effect path while still producing a screenshot.

## Goals / Non-Goals

**Goals:**

- Eliminate the repeated `classList` null error from all simulation detail routes.
- Remove known Three.js deprecation warnings for `THREE.Clock` and `PCFSoftShadowMap`.
- Make console and page-error status part of local simulation QA evidence.

**Non-Goals:**

- No broad dependency upgrade unless necessary to remove the warnings safely.
- No CI integration for React Doctor or browser console checks.
- No numerical model changes.

## Decisions

- Start from the shared failure. Because the same page error appears on all seven routes, investigate shared shell, dock, local tools, theme toggling, or effect code before individual scenes.
- Treat deprecation warnings as planned maintenance. They may not break rendering now, but keeping them creates future upgrade debt and obscures real warnings.
- Store console/page-error results with screenshot manifests. Visual pass/fail should know whether the screenshot was captured under a clean runtime.

## Risks / Trade-offs

- [Risk] Three.js API changes may differ by installed version. Mitigation: verify against the repository lockfile and current runtime before changing usage.
- [Risk] A null guard could hide the root cause of `classList`. Mitigation: identify the owning effect and write a targeted test or browser reproduction before adding guards.
- [Risk] Console capture may be noisy in dev mode. Mitigation: fail only known error-level findings and tracked warnings in the local simulation QA profile.
