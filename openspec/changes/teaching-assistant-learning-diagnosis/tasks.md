## 1. Risk scanner background pipeline

- [x] 1.1 Create `src/lib/risk-scanner.ts` with 4 deterministic rules
- [ ] 1.2 Register scheduler worker for periodic scan

## 2. Konling TA diagnosis mode

- [x] 2.1 Add 3 tool names to KonlingToolName
- [x] 2.2 Register teacher-diagnosis mode
- [x] 2.3 Implement 3 diagnosis tools with scope validation

## 3. Diagnosis report persistence

- [x] 3.1 Add DiagnosisReport model to Prisma schema
- [ ] 3.2 Generate migration
- [ ] 3.3 Implement persistence in chat API flow

## 4. Diagnosis-to-prep linking

- [ ] 4.1 Weak knowledge point links in report rendering
- [ ] 4.2 Prep workspace receives knowledgeNodeId query param

## 5. Frontend integration

- [ ] 5.1 Diagnosis entry on teacher dashboard
- [ ] 5.2 Class-level and student-level report rendering

## 6. Verification

- [ ] 6.1 Vitest unit tests for risk scanner
- [ ] 6.2 Prisma migration + validate
- [ ] 6.3 TypeScript typecheck pass