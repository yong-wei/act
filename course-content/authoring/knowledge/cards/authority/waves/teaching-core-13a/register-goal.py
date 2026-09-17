"""Register the reviewed time-domain design topic through existing static goal catalogs."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status'] == 'accepted', 'Independent card acceptance required first'
inventory = json.loads((BATCH/'inventory.json').read_text())
assert review['cardHashes'] == {c['canonicalId']: c['cardSha256'] for c in inventory['cards']}
goal = 'time-domain-design-foundations'
base = ROOT/'src/features/personalization/path-planning'
edits = {}
def replace(path, old, new):
    source = edits.get(path, path.read_text())
    assert source.count(old) == 1, (str(path), old)
    edits[path] = source.replace(old, new)

replace(base/'registered-goal-ids.ts', "  'response-metrics-foundations',", "  'response-metrics-foundations',\n  '"+goal+"',")
p = base/'goal-canonical-knowledge.ts'
source = p.read_text()
# Insert after existing final entry, preserving the explicit catalog order.
marker = '\n};'
assert source.count(marker) == 1
rows = ''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
replace(p, marker, "\n  '"+goal+"': [\n"+rows+"  ],"+marker)
p = base/'internal/assemble-plan.ts'
marker = "  { id: 'response-metrics-foundations', title: '响应指标与长期过程', description: '按统一口径计算峰值、上升和调节时间，区分瞬态、稳态与完整动态过程。', knowledge: 'time-domain-performance' },"
replace(p, marker, marker+"\n  { id: '"+goal+"', title: '时域性能与设计', description: '结合响应速度、超调与误差积分比较方案，按模型条件核验时域设计。', knowledge: 'time-domain-performance' },")
p = base/'adaptive-path-goal-options-client.ts'
marker = '\n];'
replace(p, marker, "\n  { id: '"+goal+"', label: '时域性能与设计', detail: '结合响应速度、超调与误差积分比较方案，按模型条件核验时域设计。', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"+marker)
p = ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts'
replace(p, 'toHaveLength(24)', 'toHaveLength(25)')
replace(p, "      'response-metrics-foundations',", "      'response-metrics-foundations',\n      '"+goal+"',")
p = base/'__tests__/goal-canonical-knowledge.test.ts'
replace(p, 'covers the twenty-four preset goals', 'covers the twenty-five preset goals')
replace(p, "      'response-metrics-foundations',", "      'response-metrics-foundations',\n      '"+goal+"',")
# Check every intended replacement before any write.
for path, content in edits.items():
    lines = content.splitlines(keepends=True)
    with path.open('w') as stream:
        for start in range(0, len(lines), 300):
            stream.writelines(lines[start:start+300])
print(f"Registered {goal} with {len(inventory['cards'])} reviewed canonical targets in existing catalogs")
