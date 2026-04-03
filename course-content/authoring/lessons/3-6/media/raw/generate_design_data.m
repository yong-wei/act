pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "3-6-design-data.json");

if exist(out_dir, "dir") ~= 7
  mkdir(out_dir);
endif

function out = complex_to_struct(values)
  out = struct();
  out.real = real(values);
  out.imag = imag(values);
endfunction

function out = response_to_struct(t, y)
  out = struct();
  out.t = t(:)';
  out.y = y(:)';
endfunction

function out = rlocus_to_struct(sys, increment, kmin, kmax)
  [rldata, ~] = rlocus(sys, increment, kmin, kmax);
  out = complex_to_struct(rldata);
endfunction

function out = poles_to_struct(values)
  out = struct();
  out.real = real(values(:))';
  out.imag = imag(values(:))';
endfunction

function out = step_metrics(sys, t)
  [y, t_out] = step(sys, t);
  y = y(:);
  t_out = t_out(:);
  y_final = dcgain(sys);
  tol = 0.02 * abs(y_final);
  idx = find(abs(y - y_final) <= tol);
  ts = NaN;
  if !isempty(idx)
    for k = 1:length(idx)
      if all(abs(y(idx(k):end) - y_final) <= tol)
        ts = t_out(idx(k));
        break;
      endif
    endfor
  endif

  out = struct();
  out.final_value = y_final;
  out.overshoot = (max(y) - y_final) / y_final * 100;
  out.inverse_dip = min(y);
  out.undershoot = (y_final - min(y)) / abs(y_final) * 100;
  out.settling_time_2pct = ts;
  out.response = response_to_struct(t_out, y);
endfunction

function out = margin_to_struct(sys)
  [gm, pm, wcg, wcp] = margin(sys);
  out = struct();
  out.gm = gm;
  out.pm = pm;
  out.wcg = wcg;
  out.wcp = wcp;
endfunction

function phase_deg = scalar_phase_deg(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  phase_deg = arg(resp) * 180 / pi;
  while phase_deg > 0
    phase_deg = phase_deg - 360;
  endwhile
endfunction

function mag = scalar_mag(sys, omega)
  mag = abs(squeeze(freqresp(sys, omega)));
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  mag_db = 20 * log10(abs(resp(:)))';
  phase_deg = unwrap(arg(resp(:)))' * 180 / pi;
  out = struct();
  out.w = omega(:)';
  out.mag_db = mag_db;
  out.phase_deg = phase_deg;
endfunction

s = tf("s");
Gp = 4 / (s * (s + 0.8));
Gnmp = 4 * (1 - 0.3 * s) / (s * (s + 0.8));
t = linspace(0, 12, 2401);
t_long = linspace(0, 20, 4001);
w = logspace(-2, 2, 900);

payload = struct();

specs = struct();
specs.mp_max = 20.0;
specs.ts2_max = 4.0;
specs.zeta_min = -log(0.2) / sqrt(pi^2 + log(0.2)^2);
specs.sigma_min = 4.0 / specs.ts2_max;
payload.specs = specs;

freq_specs = struct();
freq_specs.pm_target = 50.0;
freq_specs.wc_target = 3.0;
freq_specs.lead_extra_phase = 8.0;
payload.freq_specs = freq_specs;

% Base pure-gain system for tasks A / B.
base = struct();
base.root_locus = rlocus_to_struct(Gp, 0.01, 0, 4.0);
base.open_loop_poles = [0, -0.8];
base.open_loop_zeros = [];
base.real_part_constant = -0.4;
base.k_gain_limit = (0.2 / specs.zeta_min)^2;
T_base_limit = feedback(base.k_gain_limit * Gp, 1);
base.limit_metrics = step_metrics(T_base_limit, t);
base.limit_metrics.k = base.k_gain_limit;
payload.base = base;

% Task A: PD design from time-domain pole region.
pd = struct();
pd.zeta_design = 0.55;
pd.sigma_design = 1.10;
pd.wn_design = pd.sigma_design / pd.zeta_design;
pd.wd_design = pd.wn_design * sqrt(1 - pd.zeta_design^2);
pd.target_pole = complex_to_struct(-pd.sigma_design + 1i * pd.wd_design);
phi1 = arg(-pd.sigma_design + 1i * pd.wd_design) * 180 / pi;
phi2 = arg((-pd.sigma_design + 1i * pd.wd_design) + 0.8) * 180 / pi;
theta_z = phi1 + phi2 - 180;
pd.theta_pole_origin = phi1;
pd.theta_pole_minus_08 = phi2;
pd.theta_zero = theta_z;
pd.zero_location = pd.sigma_design + pd.wd_design / tan(theta_z * pi / 180);
pd.Td = 1 / pd.zero_location;
sd = -pd.sigma_design + 1i * pd.wd_design;
pd.K = abs(sd * (sd + 0.8)) / (4 * abs(1 + pd.Td * sd));
Gpd = (1 + pd.Td * s) * Gp;
pd.root_locus = rlocus_to_struct(Gpd, 0.01, 0, 3.0);
pd.open_loop_poles = [0, -0.8];
pd.open_loop_zeros = [-pd.zero_location];
T_pd = minreal(feedback(pd.K * (1 + pd.Td * s) * Gp, 1));
pd.closed_loop_poles = poles_to_struct(pole(T_pd));
pd.metrics = step_metrics(T_pd, t);
payload.pd = pd;

% Task B: rate feedback via generalized root locus.
rate = struct();
rate.equivalent_pole = 2.2;
rate.Kt = (rate.equivalent_pole - 0.8) / 4;
Geq = 4 / (s * (s + rate.equivalent_pole));
rate.root_locus = rlocus_to_struct(Geq, 0.01, 0, 3.0);
rate.open_loop_poles = [0, -rate.equivalent_pole];
rate.open_loop_zeros = [];
rate.target_pole = pd.target_pole;
rate.K = abs(sd * (sd + rate.equivalent_pole)) / 4;
T_rate = minreal(4 * rate.K / (s^2 + (0.8 + 4 * rate.Kt) * s + 4 * rate.K));
rate.closed_loop_poles = poles_to_struct(pole(T_rate));
rate.metrics = step_metrics(T_rate, t);
payload.rate = rate;

% Shared baseline for tasks C / D: only use gain to push crossover to the target value.
freq_base = struct();
freq_base.K = 1 / scalar_mag(Gp, freq_specs.wc_target);
freq_base.phase_at_target = scalar_phase_deg(Gp, freq_specs.wc_target);
freq_base.pm_at_target = 180 + freq_base.phase_at_target;
L_gain = freq_base.K * Gp;
freq_base.margins = margin_to_struct(L_gain);
freq_base.bode = bode_to_struct(L_gain, w);
freq_base.metrics = step_metrics(feedback(L_gain, 1), t_long);
payload.freq_base = freq_base;

% Task C: lead compensation for the shared frequency-domain target.
lead = struct();
lead.target_pm = freq_specs.pm_target;
lead.target_wc = freq_specs.wc_target;
lead.extra_phase = freq_specs.lead_extra_phase;
lead.phi_required = lead.target_pm - freq_base.pm_at_target + lead.extra_phase;
lead.a = (1 + sin(lead.phi_required * pi / 180)) / (1 - sin(lead.phi_required * pi / 180));
lead.T = 1 / (lead.target_wc * sqrt(lead.a));
lead.Kc = 1 / (scalar_mag(Gp, lead.target_wc) * sqrt(lead.a));
L_lead = lead.Kc * ((lead.a * lead.T * s + 1) / (lead.T * s + 1)) * Gp;
lead.bode = bode_to_struct(L_lead, w);
lead.margins = margin_to_struct(L_lead);
lead.metrics = step_metrics(feedback(L_lead, 1), t_long);
payload.lead = lead;

% Task D: frequency-domain PD under the same target.
pd_freq = struct();
pd_freq.target_pm = freq_specs.pm_target;
pd_freq.target_wc = freq_specs.wc_target;
pd_freq.phi_required = pd_freq.target_pm - freq_base.pm_at_target;
pd_freq.Td = tan(pd_freq.phi_required * pi / 180) / pd_freq.target_wc;
pd_freq.zero_location = 1 / pd_freq.Td;
pd_freq.K = 1 / (scalar_mag(Gp, pd_freq.target_wc) * abs(1 + 1i * pd_freq.target_wc * pd_freq.Td));
L_pd_freq = pd_freq.K * (1 + pd_freq.Td * s) * Gp;
pd_freq.bode = bode_to_struct(L_pd_freq, w);
pd_freq.margins = margin_to_struct(L_pd_freq);
pd_freq.metrics = step_metrics(feedback(L_pd_freq, 1), t_long);
payload.pd_freq = pd_freq;

% Task E: non-minimum-phase boundary and conservative examples.
nmp = struct();
nmp.zero_location = 1 / 0.3;
nmp.recommended_wc_ceiling = nmp.zero_location / 3;
nmp.reference_bode = bode_to_struct(Gp, w);
nmp.plant_bode = bode_to_struct(Gnmp, w);
nmp.aggressive_wc = 3.0;
nmp.aggressive_gain = 1 / scalar_mag(Gnmp, nmp.aggressive_wc);
L_nmp_aggressive = nmp.aggressive_gain * Gnmp;
nmp.aggressive_phase_at_target = scalar_phase_deg(Gnmp, nmp.aggressive_wc);
nmp.aggressive_margins = margin_to_struct(L_nmp_aggressive);

nmp.pd_example = struct();
nmp.pd_example.target_wc = 1.0;
nmp.pd_example.target_pm = 50.0;
nmp.pd_example.phi_required = nmp.pd_example.target_pm - (180 + scalar_phase_deg(Gnmp, nmp.pd_example.target_wc));
nmp.pd_example.Td = tan(nmp.pd_example.phi_required * pi / 180) / nmp.pd_example.target_wc;
nmp.pd_example.K = 1 / (scalar_mag(Gnmp, nmp.pd_example.target_wc) * abs(1 + 1i * nmp.pd_example.target_wc * nmp.pd_example.Td));
L_nmp_pd = nmp.pd_example.K * (1 + nmp.pd_example.Td * s) * Gnmp;
nmp.pd_example.margins = margin_to_struct(L_nmp_pd);
nmp.pd_example.metrics = step_metrics(feedback(L_nmp_pd, 1), t_long);

nmp.lead_example = struct();
nmp.lead_example.target_wc = 1.0;
nmp.lead_example.target_pm = 50.0;
nmp.lead_example.extra_phase = 8.0;
nmp.lead_example.phi_required = nmp.lead_example.target_pm - (180 + scalar_phase_deg(Gnmp, nmp.lead_example.target_wc)) + nmp.lead_example.extra_phase;
nmp.lead_example.a = (1 + sin(nmp.lead_example.phi_required * pi / 180)) / (1 - sin(nmp.lead_example.phi_required * pi / 180));
nmp.lead_example.T = 1 / (nmp.lead_example.target_wc * sqrt(nmp.lead_example.a));
nmp.lead_example.Kc = 1 / (scalar_mag(Gnmp, nmp.lead_example.target_wc) * sqrt(nmp.lead_example.a));
L_nmp_lead = nmp.lead_example.Kc * ((nmp.lead_example.a * nmp.lead_example.T * s + 1) / (nmp.lead_example.T * s + 1)) * Gnmp;
nmp.lead_example.margins = margin_to_struct(L_nmp_lead);
nmp.lead_example.metrics = step_metrics(feedback(L_nmp_lead, 1), t_long);

nmp.rate_example = struct();
nmp.rate_example.Kt = 0.20;
nmp.rate_example.K = 0.20;
L_nmp_rate_eq = minreal(nmp.rate_example.K * Gnmp / (1 + nmp.rate_example.Kt * s * Gnmp));
T_nmp_rate = minreal((nmp.rate_example.K * Gnmp) / (1 + (nmp.rate_example.K + nmp.rate_example.Kt * s) * Gnmp));
nmp.rate_example.margins = margin_to_struct(L_nmp_rate_eq);
nmp.rate_example.metrics = step_metrics(T_nmp_rate, t_long);

payload.nmp = nmp;

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif

fputs(fid, jsonencode(payload));
fclose(fid);

printf("Wrote %s\n", out_file);
