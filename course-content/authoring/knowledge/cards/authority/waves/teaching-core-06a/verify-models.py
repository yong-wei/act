"""Verify a shared directed signal-flow graph from its node equations."""
import json
from pathlib import Path
from fractions import Fraction as F
import numpy as np

BATCH=Path(__file__).resolve().parent
edges=[('r','x',F(2)),('x','y',F(3)),('y','x',F(-1,10)),('r','y',F(1)),('y','z',F(1))]
nodes=['r','x','y','z'];outgoing={n:[] for n in nodes};incoming={n:[] for n in nodes}
for a,b,g in edges:outgoing[a].append((b,g));incoming[b].append((a,g))
assert not incoming['r'] and not outgoing['z']
assert outgoing['y'] and incoming['y']
paths=[]
def walk(node,visited,gain):
    if node=='z':paths.append((visited,gain));return
    for nxt,g in outgoing[node]:
        if nxt not in visited:walk(nxt,visited+[nxt],gain*g)
walk('r',['r'],F(1))
assert paths==[(['r','x','y','z'],F(6)),(['r','y','z'],F(1))]
cycles={}
def cycle_walk(start,node,visited,gain):
    for nxt,g in outgoing[node]:
        if nxt==start:
            cyclic_nodes=visited[:]
            rotations=[tuple(cyclic_nodes[i:]+cyclic_nodes[:i]) for i in range(len(cyclic_nodes))]
            cycles[min(rotations)]=gain*g
        elif nxt not in visited:cycle_walk(start,nxt,visited+[nxt],gain*g)
for n in nodes:cycle_walk(n,n,[n],F(1))
assert cycles=={('x','y'):F(-3,10)}
# Independent linear-system solution, variables [x,y,z].
M=np.array([[1.,.1,0.],[-3.,1.,0.],[0.,-1.,1.]])
br=np.array([2.,1.,0.])
for r in [0.,.5,1.,-2.,1j]:
    x,y,z=np.linalg.solve(M,br*r)
    assert abs(x-F(19,13)*r)<1e-12
    assert abs(y-F(70,13)*r)<1e-12
    assert abs(z-y)<1e-12
    assert abs(x-(2*r-.1*y))<1e-12
    assert abs(y-(3*x+r))<1e-12
assert abs(np.linalg.det(M)-1.3)<1e-12
models={
 'input_output_nodes':{'input':'r','output':'z','internalFeedbackNode':'y',
    'boundary':'y feeds x and therefore is not a pure sink; z is introduced by a unity branch to serve as an output sink'},
 'loop_gain':{'cycle':['x','y','x'],'branchGains':[3,-.1],'product':-.3,
    'boundary':'multiply signed branch gains; a negative static loop gain alone is not a general dynamic stability proof'},
 'branch':{'example':'y -> x, gain=-0.1','contribution':'-0.1 y to x',
    'fullDestinationEquation':'x=2r-0.1y',
    'boundary':'branch gain determines one contribution, not necessarily the whole destination value; no automatic reverse edge'},
 'signal_flow_graph':{'nodes':nodes,'edges':[{'source':a,'target':b,'gain':float(g)} for a,b,g in edges],
    'equations':['x=2r-0.1y','y=3x+r','z=y'],'solutionForR1':{'x':'19/13','y':'70/13','z':'70/13'},
    'matrixDeterminant':1.3,'boundary':'dimensionless algebraic teaching model; no claim about physical time response or stability'},
 'forward_paths':{'paths':[{'nodes':p,'gain':float(g)} for p,g in paths],
    'sumOfForwardGains':7,'closedInputOutputGain':'70/13',
    'boundary':'a forward path follows arrow direction from input to output and repeats no node; sum of gains is not the closed graph gain when feedback is present'},
 'loop_definition':{'distinctLoops':[{'nodes':list(k)+[k[0]],'gain':float(v)} for k,v in cycles.items()],
    'sameLoopAlternativeStart':['y','x','y'],'twoTraversalsGain':.09,
    'boundary':'changing the starting node does not create a different loop; repeating the cycle twice is a closed walk, not a second elementary loop'}
}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: directed paths/cycles and independently solved node equations')
