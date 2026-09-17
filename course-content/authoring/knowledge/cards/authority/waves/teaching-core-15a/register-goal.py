"""Register the reviewed time-domain design topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'stability-concepts-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'dominant-pole-analysis-foundations',", "  'dominant-pole-analysis-foundations',\n  '"+goal+"',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'dominant-pole-analysis-foundations', title: '高阶系统与主导极点', description: '辨析模态、极点与零点，验证高阶模型的主导极点近似。', knowledge: 'time-domain-performance' },"
replace(p, marker, marker+"\n  { id: '"+goal+"', title: '稳定性概念与边界', description: '区分内部、渐近与输入输出稳定，核验边界模态和增益区间。', knowledge: 'time-domain-performance' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: '"+goal+"', label: '稳定性概念与边界', detail: '区分内部、渐近与输入输出稳定，核验边界模态和增益区间。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(26)', 'toHaveLength(27)')
replace(p, "      'dominant-pole-analysis-foundations',", "      'dominant-pole-analysis-foundations',\n      '"+goal+"',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty-six preset goals', 'covers the twenty-seven preset goals')
replace(p, "      'dominant-pole-analysis-foundations',", "      'dominant-pole-analysis-foundations',\n      '"+goal+"',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print(f"Registered {goal} with {len(inventory['cards'])} reviewed canonical targets in existing catalogs")
