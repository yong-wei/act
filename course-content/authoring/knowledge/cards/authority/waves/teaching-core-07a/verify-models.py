"""Verify Mason expansion against independently solved node equations."""
import json
from pathlib import Path
from fractions import Fraction as F
from itertools import combinations
import numpy as np

BATCH=Path(__file__).resolve().parent
edges=[('r','x',F(2)),('x','y',F(3)),('y','x',F(-1,10)),('r','y',F(1)),('y','z',F(1)),('r','q',F(4)),('q','q',F(1,5)),('q','z',F(1,2))]
nodes=['r','x','y','q','z'];outgoing={n:[] for n in nodes}
for a,b,g in edges:outgoing[a].append((b,g))
paths=[]
def path_walk(node,visited,gain):
    if node=='z':paths.append((visited,gain));return
    for nxt,g in outgoing[node]:
        if nxt not in visited:path_walk(nxt,visited+[nxt],gain*g)
path_walk('r',['r'],F(1))
assert paths==[(['r','x','y','z'],F(6)),(['r','y','z'],F(1)),(['r','q','z'],F(2))]
cycles={}
def cycle_walk(start,node,visited,gain):
    for nxt,g in outgoing[node]:
        if nxt==start:
            rotations=[tuple(visited[i:]+visited[:i]) for i in range(len(visited))]
            cycles[min(rotations)]=gain*g
        elif nxt not in visited:cycle_walk(start,nxt,visited+[nxt],gain*g)
for n in nodes:cycle_walk(n,n,[n],F(1))
assert cycles=={('x','y'):F(-3,10),('q',):F(1,5)}
def determinant(loop_items):
    total=F(1)
    for count in range(1,len(loop_items)+1):
        for subset in combinations(loop_items,count):
            node_sets=[set(item[0]) for item in subset]
            if any(a & b for a,b in combinations(node_sets,2)):continue
            product=F(1)
            for _,g in subset:product*=g
            total+=(-1)**count*product
    return total
D=determinant(list(cycles.items()));assert D==F(26,25)
cofactors=[]
for path,gain in paths:
    eligible=[item for item in cycles.items() if set(item[0]).isdisjoint(path)]
    cofactors.append(determinant(eligible))
assert cofactors==[F(4,5),F(4,5),F(13,10)]
numerator=sum((gain*cofactor for (_,gain),cofactor in zip(paths,cofactors)),F(0))
assert numerator==F(41,5)
assert numerator/D==F(205,26)
# Separate node-equation matrix, variables [x,y,q,z].
M=np.array([[1.,.1,0.,0.],[-3.,1.,0.,0.],[0.,0.,.8,0.],[0.,-1.,-.5,1.]])
br=np.array([2.,1.,4.,0.])
assert abs(np.linalg.det(M)-float(D))<1e-12
for r in [0.,.5,1.,-2.,1j]:
    x,y,q,z=np.linalg.solve(M,br*r)
    assert abs(x-F(19,13)*r)<1e-12
    assert abs(y-F(70,13)*r)<1e-12
    assert abs(q-5*r)<1e-12
    assert abs(z-F(205,26)*r)<1e-12
    assert abs(z-float(numerator/D)*r)<1e-12
    assert abs(z-y-.5*q)<1e-12
models={
 'forward_path_gain':{'paths':[{'nodes':path,'gain':str(g)} for path,g in paths],
    'sumOfPathGains':'9','boundary':'source term means the product along one path P_k, not the sum over all paths'},
 'graph_determinant':{'loopGains':['-3/10','1/5'],'nontouchingProduct':'-3/50',
    'formula':'1-(L1+L2)+L1 L2','value':'26/25','decimalValue':1.04,
    'boundary':'plus before the pair term does not make a negative product positive'},
 'path_cofactor':{'pathCofactors':['4/5','4/5','13/10'],
    'retainedLoopsByPath':[['q'],['q'],['x-y']],
    'boundary':'exclude every loop touching the chosen forward path and every product containing such a loop'},
 'mason_formula':{'weightedNumerator':'41/5','denominator':'26/25','inputOutputGain':'205/26',
    'unweightedWrongGain':'225/26','boundary':'all paths and all elementary loops counted once; denominator nonzero in this algebraic example'},
 'nontouching_loops':{'loopNodeSets':[['x','y'],['q']],'sharedNodes':[], 'gainProduct':'-3/50',
    'boundary':'no shared nodes is required; no shared branches alone would not suffice'},
 'cofactor_product_removal':{'forPathRXYZ':'Delta1=1-L2=4/5','removedTerms':['-L1','+L1 L2'],
    'forPathRQZ':'Delta3=1-L1=13/10',
    'boundary':'removing just a single-loop term from the full determinant is incorrect; mixed products must also be removed'}
}
report={'status':'passed','stage':'models-before-authoring',
    'graph':{'dimensionless':True,'edges':[{'source':a,'target':b,'gain':str(g)} for a,b,g in edges],
    'equations':['x=2r-0.1y','y=3x+r','q=4r+0.2q','z=y+0.5q'],
    'solutionForR1':{'x':'19/13','y':'70/13','q':'5','z':'205/26'}},'models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: exact Fraction loop expansion, path cofactors and independent matrix solve')
