"""Register the reviewed optimal-control cards through existing goal catalogs."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[7]
BATCH = Path(__file__).resolve().parent
inventory = json.loads((BATCH/'inventory.json').read_text())
review = json.loads((BATCH/'review-acceptance.json').read_text())
assert review['status']=='accepted'
assert review['cardHashes']=={c['canonicalId']:c['cardSha256'] for c in inventory['cards']}
for c in inventory['cards']:
    assert hashlib.sha256((ROOT/c['authoringPath']).read_bytes()).hexdigest()==c['cardSha256']
base = ROOT/'src/features/personalization/path-planning'
goal='optimal-control-foundations'
title='最优控制基础'
description='明确性能指标与约束，区分必要条件和最优性证明，理解动态规划与二次型控制的基本方法。'
p=base/'goal-canonical-knowledge.ts'
text=p.read_text()
marker="  '"+goal+"': ["
rows=''.join("    { canonicalId: '"+c['canonicalId']+"', label: '"+c['name']+"' },\n" for c in inventory['cards'])
if marker not in text:
    needle="\n};\n";assert text.count(needle)==1
    text=text.replace(needle,"\n"+marker+"\n"+rows+"  ],"+needle)
else:
    section=text.split(marker,1)[1].split('  ],',1)[0]
    assert all(c['canonicalId'] in section for c in inventory['cards'])
pending={p:text}
p=base/'registered-goal-ids.ts';text=p.read_text()
if "  '"+goal+"'," not in text:
    assert text.count('] as const;')==1
    text=text.replace('] as const;',"  '"+goal+"',\n] as const;")
pending[p]=text
p=base/'adaptive-path-goal-options-client.ts';text=p.read_text()
if "id: '"+goal+"'" not in text:
    row="  { id: '"+goal+"', label: '"+title+"', detail: '"+description+"', intentType: 'analysis', terminalValidationSummary: '以计算与条件说明核验理解；阅读不替代测评。' },"
    assert text.count('\n];')==1;text=text.replace('\n];','\n'+row+'\n];')
pending[p]=text
p=base/'internal/assemble-plan.ts';text=p.read_text()
if "id: '"+goal+"'" not in text:
    needle="]) {\n  const learningGoal = defineLearningGoal";assert text.count(needle)==1
    row="  { id: '"+goal+"', title: '"+title+"', description: '"+description+"', knowledge: 'modern-transfer' },\n"
    text=text.replace(needle,row+needle)
pending[p]=text
p=base/'__tests__/goal-canonical-knowledge.test.ts';text=p.read_text()
text=text.replace('covers the twenty-eight preset goals','covers the twenty-nine preset goals')
if "      '"+goal+"'," not in text:
    needle="      'routh-relative-stability-foundations',\n";assert text.count(needle)==1
    text=text.replace(needle,needle+"      '"+goal+"',\n")
pending[p]=text
p=ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts';text=p.read_text().replace('toHaveLength(28)','toHaveLength(29)')
if "      '"+goal+"'," not in text:
    marker="      'routh-relative-stability-foundations',\n";assert text.count(marker)==1
    text=text.replace(marker,marker+"      '"+goal+"',\n")
pending[p]=text
for p,text in pending.items():
    lines=text.splitlines(keepends=True)
    with p.open('w') as f:
        for start in range(0,len(lines),300):f.writelines(lines[start:start+300])
print('Registered seven accepted targets and optimal-control goal in server/client catalogs')
