## 1. Overlay admission

- [x] 1.1 Add the 25 snapshot-bound reviewed zh-CN `canonical_preferred` overlay rows
- [x] 1.2 Merge the overlay in the shipped label resolver only when the v0.18 snapshot matches
- [x] 1.3 Keep the sealed 1909-row index and classifier unchanged

## 2. Teaching dual-replay

- [x] 2.1 Emit byte-equivalent teaching `replay-1` and `replay-2` trees
- [x] 2.2 Make the prepare CLI write those trees on future runs

## 3. Qualification

- [x] 3.1 Add focused tests for overlay safety, snapshot binding, and resolver merge
- [x] 3.2 Re-run the shipped qualify CLI and keep production pointers on v0.9
- [x] 3.3 If the new report is READY, retarget the publisher sealed-file pin to that hash
