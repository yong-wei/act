## 1. Resource Registration

- [ ] 1.1 Define eligible simulation and Arena resource ids.
- [ ] 1.2 Add registry entries or adapters without exposing component paths in lesson plans.
- [ ] 1.3 Support registry default config, `TeachingResource.config`, and `LessonItem.overrideConfig` merge order for scene/task selection.

## 2. Course Launch Context

- [ ] 2.1 Preserve standalone routes.
- [ ] 2.2 Attach course/class/session/lesson item context when launched from DB BOPPPS and standalone provenance when launched directly.
- [ ] 2.3 Emit progress/completion evidence with the appropriate governance context through the shared resource event boundary.

## 3. Validation

- [ ] 3.1 Add focused rendering or registry tests for simulation resources, config merge order, and launch context fallback.
- [ ] 3.2 Run `rtk proxy openspec validate register-simulations-as-course-resources --strict`.
