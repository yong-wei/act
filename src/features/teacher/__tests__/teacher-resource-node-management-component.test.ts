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
});
