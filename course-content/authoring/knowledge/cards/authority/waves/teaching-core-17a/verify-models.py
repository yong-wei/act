"""Original characteristic-polynomial checks for root-locus construction and gain."""
import json,math
from pathlib import Path
import numpy as np
BATCH=Path(__file__).resolve().parent
models={}
# Separate monic gains in forward and measurement paths.
Gnum=np.array([5.,5.]);Gden=np.array([1.,2.,0.]);Hnum=np.array([2.,8.]);Hden=np.array([3.,9.])
kg=Gnum[0]/Gden[0];kh=Hnum[0]/Hden[0]
assert kg==5 and abs(kh-2/3)<1e-12
for s in [1.,2.,3.]:
 actual=np.polyval(Gnum,s)*np.polyval(Hnum,s)/(np.polyval(Gden,s)*np.polyval(Hden,s))
 monic=kg*kh*(s+1)*(s+4)/(s*(s+2)*(s+3))
 assert abs(actual-monic)<1e-12
models['path_gains']={'G':'5(s+1)/(s(s+2))','H':'(2s+8)/(3s+9)','forwardMonicGain':kg,'feedbackMonicGain':kh,'loopMonicGain':kg*kh,
 'boundary':'numerator/denominator leading-coefficient ratio; not generally the DC gain'}
L0=lambda s:(s+1)*(s+4)/(s*(s+2)*(s+3))
assert abs(L0(-5)+2/15)<1e-12
point_gain=-1/L0(-5);forward_setting=1.5*point_gain
assert abs(point_gain-7.5)<1e-12 and abs(forward_setting-11.25)<1e-12
assert abs(np.polyval([1,5+point_gain,6+5*point_gain,4*point_gain],-5))<1e-12
assert abs(1+(6/5)*L0(1)-2)<1e-12
models['point_gain']={'candidate':-5,'loopGain':point_gain,'forwardParameter':forward_setting,
 'rejectedPositiveGainCandidate':1,'rejectedCandidateRequiredSignedGain':-1/L0(1)}
# Positive-gain locus of 1/[s(s+1)(s+2)].
Kof=lambda x:-x*(x+1)*(x+2)
breaks=[-1+1/math.sqrt(3),-1-1/math.sqrt(3)]
valid=[x for x in breaks if Kof(x)>0]
assert len(valid)==1
for x,validity in [(-4,True),(-.5,True),(-1.5,False),(1,False)]:assert (Kof(x)>0)==validity
assert np.allclose(np.poly([-3,1j*math.sqrt(2),-1j*math.sqrt(2)]),[1,3,2,6])
large=np.roots([1,3,2,1e6]);angles=np.sort(np.angle(large+1)*180/math.pi)
assert np.allclose(angles,[-60,60,180],atol=.1)
models['cubic_locus']={'L0':'1/[s(s+1)(s+2)]','characteristic':'s^3+3s^2+2s+K','Kpositive':True,
 'startPoles':[0,-1,-2],'branchCount':3,'finiteZeros':0,'asymptoteCentroid':-1,
 'asymptoteAnglesDegrees':[60,180,300],'realSegments':['(-infinity,-2)','(-1,0)'],
 'stationaryCandidates':breaks,'candidateGains':[Kof(x) for x in breaks],
 'validBreakaway':valid[0],'validBreakawayGain':Kof(valid[0]),'imaginaryCrossingK':6,'imaginaryCrossingOmega':math.sqrt(2)}
# Entry into the real axis, distinguished from exit from it.
k1=5-2*math.sqrt(6);k2=5+2*math.sqrt(6)
s1=-(1+k1)/2;s2=-(1+k2)/2
for k,s in [(k1,s1),(k2,s2)]:assert abs(s*s+(1+k)*s+3*k)<1e-12
assert np.allclose(np.sort(np.roots([1,13,36])),[-9,-4])
assert np.all(abs(np.roots([1,2,3]).imag)>0)
models['break_in']={'L0':'(s+3)/(s(s+1))','characteristic':'s^2+(1+K)s+3K',
 'breakawayK':k1,'breakawayPoint':s1,'breakInK':k2,'breakInPoint':s2,
 'K1poles':[[-1,math.sqrt(2)],[-1,-math.sqrt(2)]],'K12poles':[-9,-4]}
for K in [2.,4.]:
 assert np.allclose(np.sort_complex(np.roots([1,2,K])),np.sort_complex(np.array([-1+1j*math.sqrt(K-1),-1-1j*math.sqrt(K-1)])))
 assert math.sqrt(K)>=math.sqrt(2) and 1/math.sqrt(K)>=.5
models['gain_tuning']={'L0':'1/[s(s+2)]','characteristic':'s^2+2s+K',
 'K2poles':[[-1,1],[-1,-1]],'K4poles':[[-1,math.sqrt(3)],[-1,-math.sqrt(3)]],
 'wn':'sqrt(K)','zeta':'1/sqrt(K)','underdampedWithZetaAtLeastHalf':'1<K<=4',
 'boundary':'in the underdamped interval real part remains -1 when K varies'}
assert np.allclose(np.sort(np.roots([1,2,-3])),[-3,1])
models['zero_degree']={'L0':'1/[s(s+2)]','signedGain':'K=-kappa, kappa>0','characteristic':'s^2+2s-kappa',
 'angleConditionDegrees':0,'kappa3poles':[-3,1],
 'realSegments':['(-infinity,-2)','(0,infinity)'],'boundary':'negative scalar gain in the same 1+K L0=0 convention; not every negative-gain loop has this example stability'}
assert .5-1<0
models['negative_gain_stable_counterexample']={'L0':'1/(s+1)','characteristic':'s+1-kappa','strictStableInterval':'0<kappa<1'}
(BATCH/'model-verification.json').write_text(json.dumps({'status':'passed','stage':'models-before-authoring','models':models},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(models,ensure_ascii=False,indent=2))
