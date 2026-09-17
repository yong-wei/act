"""Register the reviewed time-domain design topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'routh-relative-stability-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'stability-concepts-foundations',", "  'stability-concepts-foundations',\n  '"+goal+"',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'] if c['name'] != '格拉姆矩阵判据')
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
gramian = next(c for c in inventory['cards'] if c['name'] == '格拉姆矩阵判据')
state_marker = "  'state-space-analysis-foundations': ["
replace(p, state_marker, state_marker + "\n    { canonicalId: '" + gramian['canonicalId'] + "', label: '" + gramian['name'] + "' },")
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'stability-concepts-foundations', title: '稳定性概念与边界', description: '区分内部、渐近与输入输出稳定，核验边界模态和增益区间。', knowledge: 'time-domain-performance' },"
replace(p, marker, marker+"\n  { id: '"+goal+"', title: '劳斯判别与近似', description: '核验劳斯特殊情形、参数区间和衰减裕量，并区分判别与降阶。', knowledge: 'time-domain-performance' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: '"+goal+"', label: '劳斯判别与近似', detail: '核验劳斯特殊情形、参数区间和衰减裕量，并区分判别与降阶。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(27)', 'toHaveLength(28)')
replace(p, "      'stability-concepts-foundations',", "      'stability-concepts-foundations',\n      '"+goal+"',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty-seven preset goals', 'covers the twenty-eight preset goals')
replace(p, "      'stability-concepts-foundations',", "      'stability-concepts-foundations',\n      '"+goal+"',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print(f"Registered {goal} with {len(inventory['cards'])} reviewed canonical targets in existing catalogs")
