"""Audit the declared 458-card scope against final reviewed bytes and live local evidence."""
from pathlib import Path
from collections import Counter
import hashlib,json,subprocess
CHANGE=Path(__file__).resolve().parent
ROOT=CHANGE.parents[2]
WAVES=ROOT/'course-content/authoring/knowledge/cards/authority/waves'
FINAL=WAVES/'teaching-professional-14a'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return str(p.relative_to(ROOT))
def write(p,data):
    lines=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
    with p.open('w') as f:
        for i in range(0,len(lines),300):f.writelines(lines[i:i+300])

base_ids=['teaching-batch-01','teaching-batch-02']
baseline=[c for name in base_ids for c in read(WAVES/name/'inventory.json')['cards']]
scopes=[('retainedBaseline',baseline),('firstStage',read(WAVES/'teaching-scale-01/scope.json')['cards']),('coreExtension',read(WAVES/'teaching-scale-02/scope.json')['cards']),('professionalExtension',read(WAVES/'teaching-scale-03/candidates.json')['cards'])]
assert [len(cards) for _,cards in scopes]==[24,67,252,115]
expected=[c['canonicalId'] for _,cards in scopes for c in cards]
assert len(expected)==len(set(expected))==458
inventory_paths=sorted(WAVES.glob('*/inventory.json'))
assert len(inventory_paths)==53
cards=[];batch_reports=[];independent_count=0;body_count=0;resolved_count=0
active_authority=read(ROOT/'course-content/authoring/knowledge/authority/current.json')
for ip in inventory_paths:
    inv=read(ip);batch=ip.parent;name=inv['batchId'];assert name==batch.name
    for key in ['releaseId','snapshotId','snapshotHash']:assert inv['authority'][key]==active_authority[key],(name,key)
    review_path=batch/'review-acceptance.json';review=None
    if name not in base_ids:
        assert review_path.is_file(),name
        review=read(review_path);assert review['status']=='accepted' and review.get('reviewer'),name
        assert set(review['cardHashes'])=={c['canonicalId'] for c in inv['cards']},name
        assert review.get('findingsAccepted',0)==review.get('findingsResolved',0),name
        resolved_count+=review.get('findingsResolved',0)
        for finding in review.get('findings',[]):
            assert isinstance(finding,dict) and str(finding.get('status','')).startswith('resolved'),(name,finding)
            resolved_count+=1
        independent_count+=len(inv['cards'])
    body_review_path=batch/'body-review.json'
    if body_review_path.exists():
        br=read(body_review_path);assert br['status']=='passed',name
        assert sha(batch/'source-inventory.json')==br['sourceInventorySha256'],name
    else:br=None
    for card in inv['cards']:
        author=ROOT/card['authoringPath'];runtime=ROOT/card['authoringPath'].replace('/authoring/','/runtime/')
        digest=card['cardSha256'];assert sha(author)==sha(runtime)==digest,card['name']
        if review:assert review['cardHashes'][card['canonicalId']]==digest,card['name']
        if br:
            body=author.read_text().split('---',2)[2].strip().split('### 关联节点',1)[0].rstrip()+'\n'
            assert hashlib.sha256(body.encode()).hexdigest()==br['bodyHashes'][f"{card['order']:02}.md"],(name,card['name'])
            body_count+=1
        cards.append(card)
    batch_reports.append({'batchId':name,'cards':len(inv['cards']),'inventorySha256':sha(ip),'independentReview':rel(review_path) if review else None,'reviewSha256':sha(review_path) if review else None,'bodyReviewPresent':bool(br)})
counts=Counter(c['canonicalId'] for c in cards)
assert len(cards)==458 and all(n==1 for n in counts.values())
assert set(counts)==set(expected)
assert independent_count==434
ledger_path=ROOT/'course-content/authoring/knowledge/resource-bindings/card-replacements.json'
ledger=read(ledger_path);assert len(ledger['rows'])==458
by_id={c['canonicalId']:c for c in cards};assert set(r['canonicalId'] for r in ledger['rows'])==set(expected)
for row in ledger['rows']:
    card=by_id[row['canonicalId']]
    assert row['cardId']==card['cardId'] and row['sha256']==card['cardSha256']

binding=read(ROOT/'course-content/runtime/knowledge/resource-bindings/current.json')
projection=read(ROOT/'course-content/runtime/knowledge/projection/current.json')
manifest=read(ROOT/'course-content/runtime/knowledge/resource-bindings/releases'/binding['bindingReleaseId']/'binding-manifest.json')
integration=read(FINAL/'integration.json');assert integration['status']=='local-runtime-active'
assert manifest['bindingHash']==binding['bindingHash']==integration['bindingHash']
assert manifest['sourceHashes']['cardReplacements']==sha(ledger_path)
assert projection['projectionId']==integration['projectionId']
consumption=read(FINAL/'consumption-verification.json');assert consumption['status']=='passed'
for key in ['cards','executableCards','inspectorCards','selectedInActualGeneratedPaths','renderedMarkdownCards']:assert consumption[key]==458,key
assert consumption['unknownActiveBindingEndpoints']==consumption['invalidGoalTargets']==0
assert consumption['bindingReleaseId']==binding['bindingReleaseId'] and consumption['bindingHash']==binding['bindingHash']
assert consumption['projectionId']==projection['projectionId']
http=read(FINAL/'http-verification.json');assert http['status']=='passed' and len(http['results'])==458
assert {r['resourceId'] for r in http['results']}=={c['resourceId'] for c in cards}
assert all(r['status']==200 and r['authoredContentServed'] for r in http['results'])
assert http['completedReadingActions']==0
for name in ['teaching-professional-13a','teaching-professional-14a']:
    browser=read(WAVES/name/'browser-verification.json');assert browser['status']=='passed' and browser['displayedSelfCheck'] and browser['readingCompletions']==0
assert integration['serverPublished'] is False and integration['learnerFactsChanged'] is False

report={'status':'passed','plannedTotal':458,'actualTotal':458,'scopeCounts':{name:len(items) for name,items in scopes},'missingCanonicalIds':[],'extraCanonicalIds':[],'duplicateCanonicalIds':[],'batchCount':53,'retainedBaselineCards':24,'independentlyReviewedNewCards':434,'independentlyReviewedBatchCount':51,'reviewedBodyHashesRechecked':body_count,'resolvedFindingsExplicitInReceipts':resolved_count,'unresolvedAcceptedBlockingFindings':0,'authoringRuntimeHashMismatches':0,'bindingReleaseId':binding['bindingReleaseId'],'bindingHash':binding['bindingHash'],'projectionId':projection['projectionId'],'replacementLedgerSha256':sha(ledger_path),'authoritySnapshotId':active_authority['snapshotId'],'actualGeneratedPathCards':458,'authenticatedHTTPPages':458,'renderedMarkdownCards':458,'formulaCount':consumption['formulaCount'],'currentWorkingHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'worktreeContainsUncommittedChanges':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True)),'serverPublished':False,'learnerCompletionActions':0,'baselineReviewBoundary':'First 24 are the previously delivered and retained baseline without standalone review-acceptance receipts; the 434 scaled additions have independent accepted review receipts. No historical review record is fabricated.','provenanceLimits':['Some source nodes have no paragraph reference and are supported by explicitly bound frozen teaching literature.','Original private M1S source-span packages/scans were unavailable; recovered textbook excerpts, section hashes and public evidence-ref reconstruction support the four source-specific meanings without claiming a full private audit reconstruction.','A prior upstream relation context follow-up remains deferred; its problematic card projection was excluded and accepted review marks it resolved-in-card-projection.','A prior source sigma-sign context remains deferred; the new stability cards do not cite that ambiguous assertion and use explicit real-part conditions.'],'evidence':{rel(p):sha(p) for p in [FINAL/'integration.json',FINAL/'consumption-verification.json',FINAL/'http-verification.json',FINAL/'browser-verification.json',WAVES/'teaching-professional-13a/browser-verification.json',WAVES/'nonlinear-terminology-source-resolution.json',WAVES/'nonlinear-source-evidence/manifest.json']},'batches':batch_reports}
write(CHANGE/'completion-audit.json',report)
print(json.dumps({k:v for k,v in report.items() if k not in ['batches','evidence','provenanceLimits']},ensure_ascii=False,indent=2))
