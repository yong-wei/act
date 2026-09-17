"""Authoring-only identity, model-based numerical and actual parser checks."""
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp, quad
from scipy.signal import residue

BATCH = Path(__file__).resolve().parent
ROOT = BATCH.parents[6]
checks = []
def check(label, value):
    assert value, label
    checks.append(label)
def close(label, actual, expected, tolerance=1e-8):
    check(label, bool(np.allclose(actual, expected, rtol=tolerance, atol=tolerance)))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, data):
    lines = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").splitlines(keepends=True)
    with p.open('w') as f:
        for i in range(0, len(lines), 300): f.writelines(lines[i:i+300])

def model_checks():
    import sys
    subprocess.run([sys.executable, str(BATCH / 'verify-models.py')], cwd=ROOT, check=True, capture_output=True, text=True)
    report=json.loads((BATCH / 'model-verification.json').read_text())
    check('original six models verified', report['status']=='passed' and len(report['models'])==6)


inventory=json.loads((BATCH/'inventory.json').read_text())
scope=json.loads((BATCH/'accepted-scope.json').read_text())
authority=json.loads((ROOT/'course-content/authoring/knowledge/authority/current.json').read_text())
check('exact six unique endpoints',len(inventory['cards'])==len({c['canonicalId'] for c in inventory['cards']})==6)
check('scope identity', [c['canonicalId'] for c in inventory['cards']]==[c['canonicalId'] for c in scope['cards']])
for field in ['releaseId','snapshotId','snapshotHash']:check('current authority '+field,inventory['authority'][field]==authority[field])
for c in inventory['cards']:
    path=ROOT/c['authoringPath'];text=path.read_text()
    check('card sha '+c['cardId'],sha(path)==c['cardSha256'])
    import re
    declared=re.findall(r'^  - "([^"\n]+)"$', text.split('source_docs:\n',1)[1].split('asset_refs:',1)[0],re.M)
    check('declared source paths '+c['cardId'],declared==[r['path'] for r in c['sources']])
    for source in c['sources']:
        check('source sha '+source['path'],sha(ROOT/source['path'])==source['sha256'])
        if source.get('revision'):
            data=subprocess.check_output(['git','show',source['revision']+':'+source['path']],cwd=ROOT)
            check('source revision '+source['path'],hashlib.sha256(data).hexdigest()==source['sha256'])
    check('backup sha '+c['cardId'],sha(ROOT/c['sourceBackupPath'])==c['sourceBackupSha256'])
    neighborhood=json.loads((ROOT/c['sources'][1]['path']).read_text())
    relation_input=json.loads((BATCH/'relation-verification-input.json').read_text())
    declared=next(row['relations'] for row in relation_input['cards'] if row['canonicalId']==c['canonicalId'])
    shown=[line for line in text.split('### 关联节点',1)[1].splitlines() if line.startswith('- ')]
    check('complete displayed relations '+c['cardId'],shown==[r['renderedLine'] for r in declared])
    objects={o['id']:o for o in neighborhood['objects']}
    for row in declared:
        edge=next(r for r in neighborhood['relations'] if r['id']==row['relationId'])
        check('relation endpoints '+edge['id'],set([edge['sourceId'],edge['targetId']])==set([c['canonicalId'],row['otherId']]))
        check('relation label '+edge['id'],objects[row['otherId']]['label']==row['sourceLabel'])
        check('relation predicate/direction '+edge['id'],edge['predicate']==row['predicate'] and edge['direction']==row['direction'])
        if edge['direction']=='unordered':label='无向关联'
        elif edge['predicate']=='is_a' and edge['targetId']==c['canonicalId']:label='下位类型'
        elif edge['predicate']=='prerequisite' and edge['sourceId']==c['canonicalId']:label='后续'
        elif edge['predicate']=='applies_to' and edge['sourceId']==c['canonicalId']:label='适用对象'
        elif edge['predicate']=='has_component' and edge['sourceId']==c['canonicalId']:label='组成关系'
        else:raise AssertionError('Unexpected relation meaning')
        check('rendered direction '+edge['id'],'（'+label+'）' in row['renderedLine'])
    check('exact source node '+c['cardId'],neighborhood['nodeId']==c['canonicalId'])
    for marker in ['## 首页','## 详情','### 完整解释','### 教学计算/推理例','### 自检','核对要点','### 常见误区与边界','### 关联节点']:
        check(marker+' '+c['cardId'],marker in text)
model_checks()
# Reuse the unchanged parser/KaTeX harness only, not another batch's numerical answers.
spec=importlib.util.spec_from_file_location('previous_parser',BATCH.parent/'teaching-scale-01b/verify-content.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory(prefix='teaching-scale-01h-parser-') as tmp:
    env=os.environ.copy();env.update({'CARD_REPO_ROOT':str(ROOT),'CARD_PARSE_ROOT':tmp,'CARD_INVENTORY':str(BATCH/'inventory.json')})
    result=subprocess.run(['npx','tsx','--eval',module.TS_VERIFY],cwd=ROOT,env=env,text=True,capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr)
    parsed=json.loads(result.stdout.strip().splitlines()[-1])
write(BATCH/'numerical-verification.json',{'status':'passed','checks':checks,'checkCount':len(checks),'parser':parsed,'method':'source identity and relation semantics, six fixed original models in verify-models.py and real learner-card parser; no runtime writes'})
print(json.dumps({'status':'passed','checkCount':len(checks),'parser':parsed},ensure_ascii=False))
