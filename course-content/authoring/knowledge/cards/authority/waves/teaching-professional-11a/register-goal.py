"""Register the reviewed robust-control cards through existing goal catalogs."""
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
goal='robust-control-foundations'
title='鲁棒控制基础'
description='明确不确定集合，核验全族稳定与性能边界，区分标称设计、鲁棒保证与采样仿真。'
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
    row="  { id: '"+goal+"', title: '"+title+"', description: '"+description+"', knowledge: 'frequency-response' },\n"
    text=text.replace(needle,row+needle)
pending[p]=text
p=base/'__tests__/goal-canonical-knowledge.test.ts';text=p.read_text()
text=text.replace('covers the twenty-nine preset goals','covers the thirty preset goals')
if "      '"+goal+"'," not in text:
    needle="      'optimal-control-foundations',\n";assert text.count(needle)==1
    text=text.replace(needle,needle+"      '"+goal+"',\n")
pending[p]=text
p=ROOT/'src/lib/__tests__/adaptive-path-goal-options.test.ts';text=p.read_text().replace('toHaveLength(29)','toHaveLength(30)')
if "      '"+goal+"'," not in text:
    marker="      'optimal-control-foundations',\n";assert text.count(marker)==1
    text=text.replace(marker,marker+"      '"+goal+"',\n")
pending[p]=text
for p,text in pending.items():
    lines=text.splitlines(keepends=True)
    with p.open('w') as f:
        for start in range(0,len(lines),300):f.writelines(lines[start:start+300])
print('Registered eight accepted targets and robust-control goal in server/client catalogs')
