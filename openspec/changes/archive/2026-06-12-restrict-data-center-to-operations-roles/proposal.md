## Why

The data center is an operational and governance surface, not a meaningful student learning destination. It currently leaks into student navigation because role mapping falls back to `student`, and the presentation layer can add a data-center entry even when the role navigation does not provide one. The source marker also exposes a permanent "demo data" label, which should be controlled by administrator policy rather than hard-coded into every user-visible data view.

## What Changes

- Restrict `/data-center` and data-center navigation to teacher and administrator roles.
- Remove data-center entries from student core navigation, student review navigation, and any page-local fallback that manually appends `/data-center`.
- Redirect or deny student access with a clear role-appropriate destination such as profile, evidence, or dashboard.
- Add an administrator setting that controls whether "demo data" source labels are visible in data-center UI.
- Default the demo-data label display to off while preserving internal provenance and governance auditing.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-role-navigation`: data center becomes an operations-only route and cannot appear in student navigation.
- `commercial-student-entry-surfaces`: student review and evidence destinations use learner-record routes instead of operations data center.
- `platform-data-center-ui`: visible demo-source labels are controlled by administrator policy while source truth remains governed.
- `admin-data-governance-dashboard`: administrators can control display of demo-data labels without changing source truth.

## Impact

- Affects `/data-center`, role navigation schema, student entry/review destinations, data-center presentation navigation, source marker display, administrator configuration, and route authorization tests.
- Independent of shell collapse fixes, but should be verified with the same role-navigation route ledger.
