## 1. Inventory and identity

- [x] 1.1 Load overlay cores, nodeUnits, current B resources/bindings, runtime Authority cards, textbook locators, and simulation-task catalog
- [x] 1.2 Build exact card/task crosswalks; write exception ledger for leftovers without identity

## 2. Restage B′

- [x] 2.1 Bind lesson-unit media and classroom sims via nodeUnits; keep existing 205 bound cards
- [x] 2.2 Add extraction-source textbook locators and Arena/Odyssey/workbench task simulations
- [x] 2.3 Add runtime Authority cards whose id equals an overlay core
- [x] 2.4 Fill human-readable titles; build, stage, and activate B′ through existing teaching-projection APIs

## 3. Switch teaching consumers together

- [x] 3.1 Update `projection/current.json` and inspector sidecar to B′
- [x] 3.2 Keep sealed consumer-activation `activation-0b72f577`; overlay live `current.json` onto Konling / path / course-page / teaching-resource-rag pins
- [x] 3.3 Fail closed if sidecar and `projection/current.json` disagree, or if consumer-activation leaves the sealed id

## 4. Verify and publish

- [x] 4.1 Add focused tests for exact-only binding, ledger, and simultaneous consumer pins
- [x] 4.2 Run gate, inspector, Konling binding, and typecheck
- [ ] 4.3 After merge to `origin/integration`, freeze that SHA and run `deploy:runtime`
