## Overview

Treat data center as an operations console. The route and navigation model should make the same decision in all layers: students do not see the entry and cannot use the route, while teachers and administrators retain the data review workflow.

The demo-data label policy is a display preference, not a data mutation. Data provenance remains available for filtering, governance calculations, and admin audit even when the visible "demo data" marker is hidden.

## Navigation and Authorization

- Update the central role navigation model so `/data-center` is registered only for teacher and administrator route groups.
- Remove presentation-layer fallbacks that append a data-center entry when role navigation omits it.
- Change `/data-center` role resolution so unknown, unauthenticated, or student roles do not silently become student data-center users.
- Rewrite student review and evidence destinations that currently point to Data Center so they target learner-record surfaces such as `/profile/evidence`.
- Add route-level handling for students:
  - authenticated students should redirect to `/profile/evidence` as the default learner-record destination;
  - only an explicit contextual return target may override the default, and it must remain outside Data Center;
  - unauthenticated users should keep the existing login callback behavior;
  - unauthorized states should not render partial data-center chrome.

## Demo Data Label Policy

- Add a platform setting such as `dataCenter.showDemoSourceLabels` with default `false`.
- Surface the setting in `/admin/config` under the data governance or source display domain.
- Read the setting in data-center source marker rendering.
- When disabled, hide the visible "demo data" label for demo sources in ordinary data-center UI.
- Do not remove source family, source quality, exclusion reason, or audit data from administrator governance reports.

## Verification Strategy

- Add unit tests for role navigation proving student entries exclude `/data-center` and teacher/admin entries include it where intended.
- Add route tests for direct student access to `/data-center`.
- Add student entry tests proving review and evidence destinations do not target `/data-center`.
- Add component tests for `PresentationDataCenter` proving it does not manually restore a hidden data-center entry.
- Add admin configuration tests proving demo label display defaults off and can be enabled.
- Add DOM or browser tests for ordinary data-center UI with demo-label display disabled and enabled.
- Add visual or DOM evidence for teacher/admin data-center states and student absence.

## Risks

- Some student review flows may currently use `/data-center` as a generic "evidence" destination. They must be redirected to learner-record surfaces instead of simply removing access.
- Hiding the label must not make demo data indistinguishable in administrator audit exports or governance calculations.
