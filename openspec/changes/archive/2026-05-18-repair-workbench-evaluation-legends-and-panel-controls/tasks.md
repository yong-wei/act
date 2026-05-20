## 1. Official Submission Feedback

- [x] 1.1 Restore official submission metric rows that compare target or threshold, actual value, and status.
- [x] 1.2 Add Chinese status color semantics for reached, close, and failed metric states.
- [x] 1.3 Add Chinese explanation for valid submissions that pass hard constraints but receive score `0`.
- [x] 1.4 Remove raw English evaluator/provider notes from student-facing official submission text.

## 2. Shared Signal Styles

- [x] 2.1 Add or consolidate shared style constants for reference, uncorrected, corrected, disturbance, and correction-device curves.
- [x] 2.2 Update time-domain chart series and controls to read color and line style from the shared constants.
- [x] 2.3 Update Bode, Nyquist, and root-locus option builders or panels to read from the same shared constants where applicable.

## 3. Panel-Local Configuration

- [x] 3.1 Move time-domain configuration controls into the time-domain panel header or panel-local menu.
- [x] 3.2 Move Bode configuration controls into the Bode panel header or panel-local menu.
- [x] 3.3 Make time-domain and Bode checkable controls display the corresponding line sample and serve as the visible legend.
- [x] 3.4 Remove separate chart-area legends from time-domain and Bode panels.
- [x] 3.5 Keep root-locus source switching behavior stable.
- [x] 3.6 Make Nyquist use single-source selection between uncorrected and corrected open-loop data when both exist.
- [x] 3.7 Keep layout-level panel controls limited to add, remove, and reset behavior.

## 4. Time-Domain Range and Drawer Stability

- [x] 4.1 Compute time-domain y-axis range from all visible finite signals, including reference, with approximately 10% margin.
- [x] 4.2 Remove fixed chart aspect-ratio constraints that prevent data-driven vertical range display.
- [x] 4.3 Stabilize parameter drawer object and correction labels so clicks and structure switches do not deform the header.
- [x] 4.4 Apply distinct theme-aware active colors to current object and correction labels.

## 5. Verification

- [x] 5.1 Add or update tests for official feedback target/actual/status rows and valid-zero-score Chinese explanation.
- [x] 5.2 Add tests for shared curve style usage or option output consistency.
- [x] 5.3 Add component or source tests for panel-local time-domain, Bode, and Nyquist configuration behavior.
- [x] 5.4 Run `npm run lint`.
- [x] 5.5 Run the relevant chart/workbench test target.
