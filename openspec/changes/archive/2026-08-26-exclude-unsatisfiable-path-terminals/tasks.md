## 1. Reachable terminal gate

- [x] 1.1 Add a helper that treats a terminal as reachable when competency and evidence-count gaps are empty.
- [x] 1.2 Mark `terminalValidation: 'official'` only for reachable terminals in constraint-repair candidates.

## 2. Tests

- [x] 2.1 Cover cold-start / missing trusted portrait learners so Arena terminals locked only by competency/evidence are not candidate endpoints.
- [x] 2.2 Keep existing terminals that unlock via required completions/outcomes.
