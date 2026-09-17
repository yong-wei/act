const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const batch = __dirname;
const hash = (s) => createHash('sha256').update(s).digest('hex');
const script = fs.readFileSync(path.join(batch, 'integrate-runtime.ts'), 'utf8')
  .replace('dirname(fileURLToPath(import.meta.url))', JSON.stringify(batch));
const code = ts.transpileModule(script, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(corrupt = false) {
  const files = new Map();
  const put = (p, d) => files.set(p, JSON.stringify(d));
  const graph = '/fixture/course-content/runtime/knowledge';
  const card = { canonicalId: 'node-new', cardId: 'node-new', cardSha256: 'newhash' };
  const known = [{canonicalId:'node-old', cardId:'node-old',cardSha256:'oldhash'}];
  const rows = known.concat(card).map((r) => ({canonicalId:r.canonicalId,cardId:r.cardId,sha256:r.cardSha256}));
  if (corrupt) rows[1] = { canonicalId:'unreviewed',cardId:'unreviewed',sha256:'otherhash' };
  put('/fixture/course-content/authoring/knowledge/resource-bindings/card-replacements.json', {rows});
  const digest = hash(files.get('/fixture/course-content/authoring/knowledge/resource-bindings/card-replacements.json'));
  put('/fixture/course-content/authoring/knowledge/authority/current.json', {snapshotId:'s'});
  put('/fixture/course-content/authoring/knowledge/authority/releases/s/engineering.json', {objects:[]});
  put(path.join(batch,'inventory.json'), {cards:[card]});
  put(path.join(batch,'accepted-scope.json'), {cards:[card]});
  put(path.join(batch,'review-acceptance.json'), {status:'accepted',cardHashes:{'node-new':'newhash'}});
  put(path.join(batch,'../teaching-batch-01/inventory.json'), {cards:known});
  put(path.join(batch,'../teaching-batch-02/inventory.json'), {cards:[]});
  put(graph+'/projection/current.json', {projectionId:'new'}); // crash occurred after first pointer
  put(graph+'/resource-bindings/current.json', {bindingReleaseId:'old-binding'});
  put(graph+'/teaching-projection/domain-fragments/current.json', {projectionId:'overlay'});
  put(graph+'/teaching-projection/domain-fragments/releases/overlay/inspector-sidecar.json', {courseProjectionId:'old'});
  put(path.join(batch,'integration.json'), {status:'staged',inventoryDigest:hash(files.get(path.join(batch,'inventory.json'))),batchCanonicalIds:['node-new'],replacementDigest:digest,previousProjectionId:'old',projectionId:'new',projectionHash:'nh',previousBindingReleaseId:'old-binding',bindingReleaseId:'new-binding',bindingHash:'bh',overlayProjectionId:'overlay'});
  const binding = {manifest:{bindingHash:'bh',sourceHashes:{cardReplacements:digest}}};
  const fakeFs = {readFileSync:(p)=>{assert(files.has(p),p);return files.get(p);},existsSync:(p)=>files.has(p),writeFileSync:(p,s)=>files.set(p,s)};
  const exit = new Error('successful exit');
  const fakeRequire = (id) => {
    if(id==='node:fs') return fakeFs;
    if(id==='@/lib/teaching-projection/hash') return {projectionSha256:hash};
    if(id==='@/lib/teaching-projection/store') return {resolveTeachingProjectionStorePaths:()=>({}),activateTeachingProjection:()=>{throw Error('Already advanced projection must not reactivate');}};
    if(id==='@/lib/teaching-projection/builder') return {};
    if(id==='@/lib/resource-binding-release') return {loadResourceBindingSources:()=>({}),loadResourceBindingRelease:()=>binding,writeResourceBindingCurrentPointer:()=>put(graph+'/resource-bindings/current.json',{bindingReleaseId:'new-binding'})};
    return require(id);
  };
  let error;
  try {vm.runInNewContext(code,{require:fakeRequire,exports:{},console:{log:()=>{}},process:{cwd:()=>'/fixture',argv:['node','script','--activate'],exit:()=>{throw exit;}}});}catch(e){error=e;}
  if(corrupt) {
    assert(error && error!==exit);
    assert.equal(JSON.parse(files.get(graph+'/resource-bindings/current.json')).bindingReleaseId,'old-binding');
  } else {
    if(error!==exit) throw error ?? Error('Expected completed recovery');
    assert.equal(JSON.parse(files.get(graph+'/resource-bindings/current.json')).bindingReleaseId,'new-binding');
    assert.equal(JSON.parse(files.get(graph+'/teaching-projection/domain-fragments/releases/overlay/inspector-sidecar.json')).courseProjectionId,'new');
    assert.equal(JSON.parse(files.get(path.join(batch,'integration.json'))).status,'local-runtime-active');
  }
}
fixture(false); fixture(true);
console.log('PASS interrupted activation recovery; PASS same-count unreviewed ledger replacement rejection');
