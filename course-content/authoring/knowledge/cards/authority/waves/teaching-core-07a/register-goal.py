"""Register the reviewed Mason topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'mason-gain-formula-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'block-diagram-modeling-foundations',", "  'block-diagram-modeling-foundations',\n  'mason-gain-formula-foundations',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'block-diagram-modeling-foundations', title: '结构图建模与等效化简', description: '从变量方程建立结构图，保留输入位置和负载条件，验证代数化简与反馈互联。', knowledge: 'transfer-function-model' },"
replace(p, marker, marker+"\n  { id: 'mason-gain-formula-foundations', title: '梅森公式与通路余子式', description: '逐项确定通路、回路、不接触组合与余子式，并用节点方程复核增益。', knowledge: 'transfer-function-model' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: 'mason-gain-formula-foundations', label: '梅森公式与通路余子式', detail: '逐项确定通路、回路、不接触组合与余子式，并用节点方程复核增益。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(18)', 'toHaveLength(19)')
replace(p, "      'block-diagram-modeling-foundations',", "      'block-diagram-modeling-foundations',\n      'mason-gain-formula-foundations',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the eighteen preset goals', 'covers the nineteen preset goals')
replace(p, "      'block-diagram-modeling-foundations',", "      'block-diagram-modeling-foundations',\n      'mason-gain-formula-foundations',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print('Registered Mason goal and six reviewed canonical targets in existing catalogs')
