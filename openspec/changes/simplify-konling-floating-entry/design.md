## Design Notes

The bottom-right floating control should behave like a direct assistant affordance, not a generic toolbox. If Konling is available, the visible button opens Konling immediately.

Theme switching belongs in the page header or shell account/action area. It should not be injected into bottom floating controls.

Implementation should only remove the bottom-dock theme entry after confirming homepage and AppShell routes expose top-right theme switching. This prevents a transition state where users lose theme control on routes that previously relied on the bottom dock.

If a route needs other page-level controls, the implementation should place them in AppShell action slots, local toolbars, or an approved secondary dock pattern. Those controls must not make the primary Konling launcher ambiguous.

The change should integrate with the existing unified Konling chat and citation work rather than reimplementing chat UI. It only concerns the global entrypoint and floating-control information architecture.
