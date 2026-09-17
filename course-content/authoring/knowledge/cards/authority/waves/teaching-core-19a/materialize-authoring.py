"""Materialize twelve fixed bodies with exact source and relation metadata."""
from pathlib import Path
import json
import hashlib
BATCH=Path(__file__).resolve().parent
ROOT=BATCH.parents[6]
s=json.loads((BATCH/'source-inventory.json').read_text());a=s['authority'];rels=[];pending=[]
pred={'association':'相关','is_a':'属于','part_of':'组成部分属于','has_formula':'具有公式','derived_from':'推导自','applies_to':'适用于','has_representation':'有表示','prerequisite':'前置于','has_component':'包含组件','used_to_analyze':'用于分析'}
for row in s['cards']:
    p=ROOT/row['authoringPath']
    body=(BATCH/'bodies'/f"{row['order']:02}.md").read_text().split('### 关联节点')[0].strip()
    english=body.split(' | ',1)[1].split('\n',1)[0]
    n=json.loads((ROOT/row['sources'][1]['path']).read_text());objects={x['id']:x for x in n['objects']};entries=[];candidates=[]
    for r in n['relations']:
        if row['canonicalId'] not in [r['sourceId'],r['targetId']]:continue
        other=r['targetId'] if r['sourceId']==row['canonicalId'] else r['sourceId']
        if objects[other]["canonicalType"] != "DomainConcept": continue
        candidates.append((r,other))
    candidates.sort(key=lambda pair:(objects[pair[1]]['canonicalType']!='DomainConcept',len(objects[pair[1]]['label'])))
    for r,other in candidates[:3]:
        label=objects[other]['label'];direction='无向' if r['direction']=='unordered' else ('出边' if r['sourceId']==row['canonicalId'] else '入边')
        display='$'+label+'$' if label.startswith('\\') else '**'+label+'**'
        line=f"- {display}（{direction}，关系：{pred[r['predicate']]}）"
        entries.append({'relationId':r['id'],'otherId':other,'label':label,'predicate':r['predicate'],'direction':r['direction'],'renderedLine':line})
    rels.append({'canonicalId':row['canonicalId'],'relations':entries})
    body+='\n\n### 关联节点\n\n'+ ('\n'.join(e['renderedLine'] for e in entries) if entries else '本卡的结论可由上述定义与计算例独立复核。')+'\n'
    header=['---','node_id: '+row['cardId'],'authority_entity_id: "'+row['canonicalId']+'"','name: "'+row['name']+'"','name_en: "'+english+'"','category: 概念性','knowledge_type: C','bloom_level: 应用','card_version: 3','content_origin: act-course-enrichment','authority_release_id: "'+a['releaseId']+'"','authority_snapshot_id: "'+a['snapshotId']+'"','authority_snapshot_hash: "'+a['snapshotHash']+'"','status: ready','source_docs:']
    header += ['  - "'+x['path']+'"' for x in row['sources']]+['asset_refs: []','---','']
    data=('\n'.join(header)+'\n'+body).encode()
    if p.exists():
        assert p.read_bytes()==data or hashlib.sha256(p.read_bytes()).hexdigest()==row['previousCardSha256'],row['name']
    else:assert row['previousCardSha256'] is None
    pending.append((p,data,BATCH/'bodies'/f"{row['order']:02}.md",body))
# Validate all old/current bytes before applying this deterministic materialization.
for p,data,bodypath,body in pending:
    p.write_bytes(data);bodypath.write_text(body)
def write(p,d):
    lines=(json.dumps(d,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
    with p.open('w') as f:
        for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
write(BATCH/'relation-verification-input.json',{'cards':rels})
scope=json.loads((BATCH/'scope.json').read_text());scope['status']='authoring';write(BATCH/'scope.json',scope)
write(BATCH/'accepted-scope.json',{**scope,'status':'pending-independent-review','accepted':False})
print('Materialized twelve candidate cards with exact relations')
