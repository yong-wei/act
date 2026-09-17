"""Verify bandwidth, resonance and asymptote examples before authoring."""
from pathlib import Path
import cmath,json,math
BATCH=Path(__file__).resolve().parent
models={}
K=2.;tau=.5;wb=1/tau;G=lambda w:K/(1+1j*tau*w)
assert abs(abs(G(wb))/abs(G(0))-1/math.sqrt(2))<1e-12
models['first_order_bandwidth']={'T':'2/(0.5s+1)','dcGain':K,'relativeThresholdDb':-10*math.log10(2),'bandwidthRadPerSec':wb,'absoluteLevelAtBandwidthDb':20*math.log10(abs(G(wb))),'boundary':'relative to DC; not absolute -3dB for nonunit DC gain'}
wn=4.;z=.5;T=lambda w:wn**2/((1j*w)**2+2*z*wn*1j*w+wn**2)
wr=wn*math.sqrt(1-2*z*z);mr=1/(2*z*math.sqrt(1-z*z));wb=wn*math.sqrt(1-2*z*z+math.sqrt((2*z*z-1)**2+1))
assert abs(abs(T(wr))-mr)<1e-12
assert abs(abs(T(wb))-1/math.sqrt(2))<1e-12
assert all(abs(T(w))<=mr+1e-9 for w in [j/100 for j in range(2001)])
models['second_order']={'wn':wn,'zeta':z,'resonantFrequency':wr,'resonantPeakRatio':mr,'resonantPeakDb':20*math.log10(mr),'bandwidth':wb,'boundary':'unit DC, stable second-order low-pass without zeros; resonance formula only 0<zeta<1/sqrt(2)'}
z=3.;ratio=math.sqrt(1-2*z*z+math.sqrt((2*z*z-1)**2+1));assert ratio<.5
models['overdamped_counterexample']={'wn':4,'zeta':z,'bandwidthToNaturalFrequency':ratio,'boundary':'no universal factor-of-two bandwidth/natural-frequency rule for arbitrary damping'}
# First order pole corner and low-frequency compound shape.
H=lambda w:10*(1+1j*w/10)/((1j*w)*(1+1j*w))
models['low_frequency']={'L':'10(1+s/10)/[s(1+s)]','finiteCorners':[1,10],'lowFrequencyAsymptoteDb':'20-20log10(omega)','atPoint1':{'omega':.1,'exactMagnitudeDb':20*math.log10(abs(H(.1))),'asymptoteMagnitudeDb':40},'boundary':'integrator has no finite positive corner; low-frequency segment need not be horizontal'}
for w in [.01,.1,1,10,100]:
 h=1/(1+1j*w);asym=0 if w<=1 else -20*math.log10(w)
 if w==1:assert abs(20*math.log10(abs(h))+10*math.log10(2))<1e-12
models['corner']={'G':'1/(s+1)','corner':1,'exactAtCornerDb':-10*math.log10(2),'asymptoteAtCornerDb':0,'slopesDbPerDecade':[0,-20],'boundary':'corner belongs to factor; not generally equal to gain crossover or closed-loop bandwidth'}
# Show distinction with P=1/(s+1), C=2.
wc=math.sqrt(3);closed_wb=3.
assert abs(abs(2/(1+1j*wc))-1)<1e-12
assert abs(abs(2/(3+1j*closed_wb))/(2/3)-1/math.sqrt(2))<1e-12
models['frequency_distinction']={'loop':'2/(s+1)','closed':'2/(s+3)','openCorner':1,'gainCrossover':wc,'closedBandwidth':closed_wb}
report={'status':'passed','stage':'models-before-authoring','models':models}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
