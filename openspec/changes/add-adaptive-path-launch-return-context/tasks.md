## 1. Launch Context

- [ ] 1.1 Add a normalized path launch context mapper for path node actions.
- [ ] 1.2 Include source, goal id, path id, node id, route intent, return href, and resource type in supported launch targets.
- [ ] 1.3 Keep existing execution `started` recording behavior unchanged.

## 2. Return Controls

- [ ] 2.1 Update interactive resource route return behavior to consume valid path launch context.
- [ ] 2.2 Update shared course runtime return behavior to consume valid path launch context.
- [ ] 2.3 Preserve Interactive Learning or course-entry return targets for non-path launches.

## 3. Validation

- [ ] 3.1 Run `rtk openspec validate add-adaptive-path-launch-return-context --strict`.
- [ ] 3.2 Add tests for path launch context generation and target return href parsing.
- [ ] 3.3 Add a negative test proving non-path resource opens keep their original return target.
- [ ] 3.4 Browser-check launching a representative precheck or interactive resource from path execution and using `返回学习路径`.
