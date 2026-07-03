## Tasks

- [ ] 1. Define the canonical primary navigation order in the central navigation layer.
  - Add a single ordered route/entry contract for Home, Knowledge Resources, Interactive Learning, Learning Path, Arena, Virtual Simulation, Control Workbench, and Personal Center.
  - Preserve collapsed rail behavior and expanded text behavior.

- [ ] 2. Wire primary consumers to the canonical order.
  - Update homepage entry derivation, AppShell route navigation, student cockpit navigation, and account/profile route access so they derive from the central order.
  - Keep local workspace tools and teacher/admin operation tabs secondary.

- [ ] 3. Add navigation-order validation.
  - Add unit or governance tests that verify homepage, `/knowledge`, `/interactive-learning`, `/assessment/adaptive-practice`, `/arena`, `/simulations`, `/interactive-learning/control-workbench`, and `/profile` expose the expected primary order.
  - Include collapsed and expanded AppShell states where feasible.

- [ ] 4. Validate the change.
  - Run `rtk openspec validate standardize-primary-navigation-order --strict`.
  - Run the targeted navigation tests or governance checks.
  - Capture representative visual evidence for folded and expanded rail state.
