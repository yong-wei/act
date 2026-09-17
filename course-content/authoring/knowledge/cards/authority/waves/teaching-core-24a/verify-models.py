"""Original analytic frequency-response models, independent of authored cards."""
from pathlib import Path
import cmath,json,math
BATCH=Path(__file__).resolve().parent
rows=[]
for w in [0,0.1,1,10,100]:
 g=2/(1+1j*w)
 assert abs(g.real-2/(1+w*w))<1e-12
 assert abs(g.imag+2*w/(1+w*w))<1e-12
 assert abs((g.real-1)**2+g.imag**2-1)<1e-12
 mag=abs(g);phase=math.degrees(cmath.phase(g));db=20*math.log10(mag)
 assert abs(phase+math.degrees(math.atan(w)))<1e-12
 rows.append({'omega':w,'real':g.real,'imag':g.imag,'magnitude':mag,'phaseDegrees':phase,'magnitudeDb':db})
# Exact forced sinusoid plus transient from the original ODE y'+y=2 sin(t).
for t in [0,.1,1,2,10]:
 y=math.sin(t)-math.cos(t)+math.exp(-t)
 yp=math.cos(t)+math.sin(t)-math.exp(-t)
 assert abs(yp+y-2*math.sin(t))<1e-12
# Lead design at fixed crossover. Plant L0=2/[s(s+1)], wc=1.
z=.5;p=2.;wc=1.;gain=1/(2*math.sqrt(2))
lead=lambda s:gain*(1+s/z)/(1+s/p)
L=lambda s:2/(s*(s+1))
comp=lead(1j)*L(1j)
assert abs(abs(comp)-1)<1e-12
phase=math.degrees(cmath.phase(comp));pm=180+phase
assert abs(pm-(45+math.degrees(math.atan(2)-math.atan(.5))))<1e-12
# Closed characteristic: .5s^3+1.5s^2+(1+4K)s+2K.
a,b,c,d=.5,1.5,1+4*gain,2*gain
assert all(v>0 for v in [a,b,c,d]) and b*c>a*d
report={'status':'passed','stage':'models-before-authoring','models':{
 'first_order_frequency':{'G':'2/(s+1)','samples':rows,'polarCircle':'(Re G-1)^2+(Im G)^2=1; positive frequencies trace lower semicircle from 2 toward 0','bodeAxes':'logarithmic positive omega vs magnitude dB and phase degrees','nicholsAxes':'phase degrees horizontal, magnitude dB vertical; both linear scales; omega is parameter'},
 'forced_response':{'ode':'y_dot+y=2 sin(t); y(0)=0','exact':'sin(t)-cos(t)+exp(-t)','steady':'sqrt(2) sin(t-pi/4)','boundary':'frequency response describes asymptotic sinusoid only when transients decay'},
 'lead_design':{'plantLoop':'2/[s(s+1)]','controller':'K(1+s/0.5)/(1+s/2)','K':gain,'crossover':wc,'phaseDegrees':phase,'phaseMarginDegrees':pm,'closedCoefficients':[a,b,c,d],'routhPositive':True},
 'phase_boundary':{'G':'1/(s+1)^3','omega':10,'continuousPhaseDegrees':-3*math.degrees(math.atan(10)),'principalPhaseDegrees':math.degrees(cmath.phase(1/(1+10j)**3)),'boundary':'branches differ by 360 degrees, unwrap before interpreting continuous phase'},
 'unstable_counterexample':{'G':'1/(s-1)','input':'sin(t)','zeroStateResponse':'(exp(t)-sin(t)-cos(t))/2','boundary':'G(jw) exists but unstable transient prevents asymptotic sinusoidal steady response'}
}}
(BATCH/'model-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
