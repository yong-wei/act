import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
  join(process.cwd(), 'src/features/teacher/resources/teacher-resource-node-management.tsx'),
  'utf8',
);

describe('teacher ResourceNode management component safeguards', () => {
  it('remounts the editable detail form when the selected node changes', () => {
    expect(componentSource).toContain('<NodeDetail key={selectedNode.id}');
  });

  it('keeps the detail panel bound to the current filtered result set', () => {
    expect(componentSource).toContain(
      'const selectedNode = filteredNodes.find((node) => node.id === selectedId) ?? filteredNodes[0] ?? null;'
    );
    expect(componentSource).not.toContain('?? filteredNodes[0] ?? nodes[0] ?? null');
  });

  it('exposes mapped and unmapped knowledge mapping filters in the teacher UI', () => {
    expect(componentSource).toContain('const [knowledgeMapping, setKnowledgeMapping]');
    expect(componentSource).toContain("knowledgeMapping === 'mapped'");
    expect(componentSource).toContain("knowledgeMapping === 'unmapped'");
    expect(componentSource).toContain('<option value="mapped">已映射</option>');
    expect(componentSource).toContain('<option value="unmapped">未映射</option>');
  });

  it('keeps readiness metadata editable in the teacher planning form', () => {
    expect(componentSource).toContain('readiness: {');
    expect(componentSource).toContain("parseNumericRecord(form.get('readinessMinimumCompetency'))");
    expect(componentSource).toContain("splitCsv(form.get('readinessRequiredCompletedNodeIds'))");
    expect(componentSource).toContain("splitCsv(form.get('readinessRequiredOutcomeRefs'))");
    expect(componentSource).toContain('name="readinessUnlockMessage"');
    expect(componentSource).toContain('Readiness 解锁条件');
  });

  it('shows read-only mapping audit fields without adding editable ownership controls', () => {
    expect(componentSource).toContain('映射审计');
    expect(componentSource).toContain('node.audit.capabilityMappingPresent');
    expect(componentSource).toContain('node.audit.citationTargetReady');
    expect(componentSource).toContain('node.audit.evidenceCapabilityConfigured');
    expect(componentSource).toContain('node.audit.sourceOwnership');
    expect(componentSource).not.toContain('name="sourceOwnership"');
    expect(componentSource).not.toContain('name="capabilityMapping"');
  });
});
