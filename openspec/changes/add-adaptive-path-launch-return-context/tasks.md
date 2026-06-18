## 1. Launch Context

- [x] 1.1 Add a normalized path launch context mapper for path node actions.
- [x] 1.2 Include source, goal id, path id, node id, route intent, return href, and resource type in supported launch targets.
- [x] 1.3 Keep existing execution `started` recording behavior unchanged.

## 2. Return Controls

- [x] 2.1 Update interactive resource route return behavior to consume valid path launch context.
- [x] 2.2 Update shared course runtime return behavior to consume valid path launch context.
- [x] 2.3 Preserve Interactive Learning or course-entry return targets for non-path launches.

## 3. Validation

- [x] 3.1 Run `rtk openspec validate add-adaptive-path-launch-return-context --strict`.
- [x] 3.2 Add tests for path launch context generation and target return href parsing.
- [x] 3.3 Add a negative test proving non-path resource opens keep their original return target.
- [x] 3.4 Browser-check launching a representative precheck or interactive resource from path execution and using `返回学习路径`.
