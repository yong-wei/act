"""Verify feedback conventions, auxiliary root-locus models and port choices."""
import json
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp

BATCH=Path(__file__).resolve().parent
models={};t=np.linspace(0,6,1201)
# A parameter-dependent physical equation and an auxiliary unity-feedback loop.
K=1.;a=[1,3,2];b=[1,4];den=np.polyadd(a,np.polymul([K],b))
assert np.allclose(den,[1,4,6])
A=np.array([[0.,1.],[-6.,-4.]]);B=np.array([0.,1.])
for s in [.3,1j,3.]:
    L0=(s+4)/(s*s+3*s+2)
    original=1/(s*s+4*s+6);aux=L0/(1+L0)
    assert abs(np.array([1.,0.])@np.linalg.solve(s*np.eye(2)-A,B)-original)<1e-12
    assert abs(np.array([4.,1.])@np.linalg.solve(s*np.eye(2)-A,B)-aux)<1e-12
models['equivalent_unit_feedback']={'originalEquation':'q_ddot+(3+K)q_dot+(2+4K)q=r',
    'characteristic':'a(s)+K b(s), a=s^2+3s+2, b=s+4','auxiliaryLoop':'K(s+4)/(s^2+3s+2)',
    'K':1,'originalReferenceTransfer':'1/(s^2+4s+6)','auxiliaryClosedTransfer':'(s+4)/(s^2+4s+6)',
    'originalDCGain':'1/6','auxiliaryDCGain':'2/3',
    'boundary':'equivalent characteristic equation for parameter root locus, not an assertion of identical reference/output transfer or internal physical signals'}
value=(1j+4)/((1j)**2+3j+2);assert abs(value-(.7-1.1j))<1e-12
models['root_locus_loop']={'L0':'b(s)/a(s)=(s+4)/((s+1)(s+2))','parameterEquation':'1+K L0(s)=0',
    'openPoles':[-1,-2],'openZero':-4,'L0AtJ':[.7,-1.1],
    'boundary':'state explicitly whether adjustable K is included in L or separated; the auxiliary loop need not equal an original physical open-loop path'}
for h in [.5,2.]:
    for s in [.3,1j,3.]:
        P=1/(s+1)
        assert abs(P/(1-h*P)-1/(s+1-h))<1e-12
h=.5;outerK=2.
y=solve_ivp(lambda t,y:[-y[0]+outerK*(1-y[0])+h*y[0]], [0,6],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,.8*(1-np.exp(-2.5*t)),atol=1e-10)
models['positive_feedback']={'plant':'1/(s+1)','innerEquation':'y=P(v+h y)',
    'innerCases':[{'h':.5,'pole':-.5},{'h':2,'pole':1}],
    'outerNegativeFeedback':'v=2(r-y) with h=0.5','fullClosedTransfer':'2/(s+2.5)',
    'fullUnitStep':'0.8(1-exp(-2.5t))',
    'boundary':'a positive inner loop alone does not determine overall stability; evaluate the complete signed interconnection'}
# Additive output disturbance: y=x+d, with x the physical plant state.
for r,d,expected in [(1.,0.,1-np.exp(-2*t)),(0.,1.,.5+.5*np.exp(-2*t))]:
    x=solve_ivp(lambda t,x:[-x[0]+2*(r-.5*(x[0]+d))],[0,6],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
    assert np.allclose(x+d,expected,atol=1e-10)
models['closed_transfer']={'plant':'2/(s+1)','H':.5,'equations':['x_dot=-x+2e','y=x+d','e=r-0.5y'],
    'referenceTransfer':'2/(s+2)','outputDisturbanceTransfer':'(s+1)/(s+2)',
    'referenceUnitStep':'1-exp(-2t)','outputDisturbanceUnitStep':'0.5+0.5exp(-2t)',
    'boundary':'a closed-loop transfer is tied to selected input/output ports; output disturbance differs from an input disturbance'}
y=solve_ivp(lambda t,y:[-y[0]+2*(1-y[0])],[0,6],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
assert np.allclose(y,2/3*(1-np.exp(-3*t)),atol=1e-10)
models['unit_negative_feedback']={'G':'2/(s+1)','H':1,'error':'e=r-y','closedTransfer':'2/(s+3)',
    'unitStep':'(2/3)(1-exp(-3t))','steadyError':'1/3',
    'boundary':'unity measurement feedback does not mean unity closed-loop DC gain; reference and measured output must use consistent units'}
for feedback,decay in [(False,1.),(True,3.)]:
    y=solve_ivp(lambda t,y:[-y[0]+2*(.5-(y[0] if feedback else 0))],[0,6],[0.],t_eval=t,rtol=1e-12,atol=1e-14).y[0]
    assert np.allclose(y,(1/decay)*(1-np.exp(-decay*t)),atol=1e-10)
models['open_loop_system']={'plant':'2/(s+1)','openCommand':'u=r','openUnitReferenceStep':'2(1-exp(-t))',
    'inputDisturbanceComparison':'r=0, d=0.5 added at plant input',
    'openDisturbanceResponse':'1-exp(-t)','negativeFeedbackResponse':'(1/3)(1-exp(-3t))',
    'boundary':'comparison concerns the specified disturbance port, not an unqualified claim that feedback always improves every performance metric'}
cases=[]
for K in [2.,5.]:
    value=K/(1j*(1+1j))
    assert abs(abs(value)-K/np.sqrt(2))<1e-12
    assert abs(np.angle(value,deg=True)+135)<1e-12
    cases.append({'K':K,'magnitudeAtOneRadPerUnitTime':float(abs(value)),'phaseDegrees':float(np.angle(value,deg=True))})
models['open_loop_gain']={'loop':'K/(s(s+1))','cases':cases,'DCGain':'unbounded due to integrator, not K',
    'boundary':'K is a gain multiplier in this normalized model; distinguish it from DC gain and gain margin, and preserve any source-specific parameter definition'}
report={'status':'passed','stage':'models-before-authoring','models':models}
lines=(json.dumps(report,ensure_ascii=False,indent=2)+'\n').splitlines(keepends=True)
with (BATCH/'model-verification.json').open('w') as f:
    for i in range(0,len(lines),300):f.writelines(lines[i:i+300])
print('PASS: seven feedback models, original ODE and transfer-identity checks')
