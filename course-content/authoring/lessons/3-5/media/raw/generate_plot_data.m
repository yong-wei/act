pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "3-5-plot-data.json");

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

function out = bode_to_struct(sys, w)
  [mag, phase] = bode(sys, w);
  mag = squeeze(mag);
  phase = squeeze(phase);

  out = struct();
  out.w = w(:)';
  out.mag_db = (20 * log10(mag))(:)';
  out.phase_deg = phase(:)';
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

s = tf("s");

payload = struct();

% Example 1: low-order pure-pole system with different zero positions.
low_order = struct();
low_order.base = rlocus_to_struct(1 / (s * (s + 1)), 0.01, 0, 60);
low_order.zero_left = rlocus_to_struct((s + 2) / (s * (s + 1)), 0.01, 0, 60);
low_order.zero_between = rlocus_to_struct((s + 0.5) / (s * (s + 1)), 0.01, 0, 60);
low_order.open_loop_poles = [-1, 0];
low_order.zero_positions = [-2, -0.5];
payload.low_order = low_order;

% Example 2: third-order pure-pole system with zeros at different positions.
high_order = struct();
high_order.base = rlocus_to_struct(1 / (s * (s + 1) * (s + 4)), 0.01, 0, 180);
high_order.zero_near_origin = rlocus_to_struct((s + 0.4) / (s * (s + 1) * (s + 4)), 0.01, 0, 180);
high_order.zero_middle = rlocus_to_struct((s + 2.5) / (s * (s + 1) * (s + 4)), 0.01, 0, 180);
high_order.open_loop_poles = [-4, -1, 0];
high_order.zero_positions = [-0.4, -2.5];
payload.high_order = high_order;

% Example 3: PD vs rate feedback on the same second-order plant.
omega_n = 2.0;
zeta0 = 0.2;
Kd = 0.3;
Kt = 0.3;
Gp = omega_n^2 / (s * (s + 2 * zeta0 * omega_n));
Cpd = 1 + Kd * s;
G_rate_eq = Gp / (1 + Kt * s * Gp);

T_base = feedback(Gp, 1);
T_pd = feedback(Cpd * Gp, 1);
T_rate = feedback(G_rate_eq, 1);

t = linspace(0, 12, 1201);
[y_base, t_step] = step(T_base, t);
[y_pd, ~] = step(T_pd, t);
[y_rate, ~] = step(T_rate, t);
w = logspace(-2, 2, 800);

pd_rate = struct();
pd_rate.base_zeta = zeta0;
pd_rate.eq_zeta = zeta0 + 0.5 * Kt * omega_n;
pd_rate.Kd = Kd;
pd_rate.Kt = Kt;
pd_rate.root_locus_pd = rlocus_to_struct(Cpd * Gp, 0.01, 0, 40);
pd_rate.root_locus_rate = rlocus_to_struct(G_rate_eq, 0.01, 0, 40);
pd_rate.open_loop_poles_pd = [0, -2 * zeta0 * omega_n];
pd_rate.open_loop_zeros_pd = [-1 / Kd];
pd_rate.open_loop_poles_rate = [0, -(2 * zeta0 * omega_n + Kt * omega_n^2)];
pd_rate.open_loop_zeros_rate = [];
pd_rate.step_base = response_to_struct(t_step, y_base);
pd_rate.step_pd = response_to_struct(t_step, y_pd);
pd_rate.step_rate = response_to_struct(t_step, y_rate);
pd_rate.bode_base = bode_to_struct(T_base, w);
pd_rate.bode_pd = bode_to_struct(T_pd, w);
pd_rate.bode_rate = bode_to_struct(T_rate, w);
pd_rate.poles_base = poles_to_struct(pole(T_base));
pd_rate.poles_pd = poles_to_struct(pole(T_pd));
pd_rate.poles_rate = poles_to_struct(pole(T_rate));
payload.pd_rate = pd_rate;

% Example 4: PD vs lead correction on the same plant.
a = 5.0;
Tlead = 0.06;
Clead = (a * Tlead * s + 1) / (Tlead * s + 1);
T_lead = feedback(Clead * Gp, 1);

[y_lead, ~] = step(T_lead, t);

pd_lead = struct();
pd_lead.zero_pd = -1 / Kd;
pd_lead.zero_lead = -1 / (a * Tlead);
pd_lead.pole_lead = -1 / Tlead;
pd_lead.root_locus_pd = rlocus_to_struct(Cpd * Gp, 0.01, 0, 30);
pd_lead.root_locus_lead = rlocus_to_struct(Clead * Gp, 0.01, 0, 30);
pd_lead.controller_bode_pd = bode_to_struct(Cpd, w);
pd_lead.controller_bode_lead = bode_to_struct(Clead, w);
pd_lead.openloop_bode_base = bode_to_struct(Gp, w);
pd_lead.openloop_bode_pd = bode_to_struct(Cpd * Gp, w);
pd_lead.openloop_bode_lead = bode_to_struct(Clead * Gp, w);
pd_lead.step_base = response_to_struct(t_step, y_base);
pd_lead.step_pd = response_to_struct(t_step, y_pd);
pd_lead.step_lead = response_to_struct(t_step, y_lead);
pd_lead.poles_base = poles_to_struct(pole(T_base));
pd_lead.poles_pd = poles_to_struct(pole(T_pd));
pd_lead.poles_lead = poles_to_struct(pole(T_lead));
payload.pd_lead = pd_lead;

% Example 5: minimum-phase vs nonminimum-phase mirror pair.
G_mp = 4 * (s + 1) / (s * (s + 2) * (s + 5));
G_nmp = 4 * (1 - s) / (s * (s + 2) * (s + 5));
K_nmp_mid = 1.0;
K_nmp_low = 0.6;
K_nmp_high = 2.0;

T_mp = feedback(K_nmp_mid * G_mp, 1);
T_nmp_mid = feedback(K_nmp_mid * G_nmp, 1);
T_nmp_low = feedback(K_nmp_low * G_nmp, 1);
T_nmp_high = feedback(K_nmp_high * G_nmp, 1);

[y_mp, ~] = step(T_mp, t);
[y_nmp_mid, ~] = step(T_nmp_mid, t);
[y_nmp_low, ~] = step(T_nmp_low, t);
[y_nmp_high, ~] = step(T_nmp_high, t);

nmp = struct();
nmp.root_locus_mp = rlocus_to_struct(G_mp, 0.01, 0, 3.2);
nmp.root_locus_nmp = rlocus_to_struct(G_nmp, 0.01, 0, 3.2);
nmp.step_mp = response_to_struct(t_step, y_mp);
nmp.step_nmp_mid = response_to_struct(t_step, y_nmp_mid);
nmp.step_nmp_low = response_to_struct(t_step, y_nmp_low);
nmp.step_nmp_high = response_to_struct(t_step, y_nmp_high);
nmp.openloop_bode_mp = bode_to_struct(K_nmp_mid * G_mp, w);
nmp.openloop_bode_nmp = bode_to_struct(K_nmp_mid * G_nmp, w);
nmp.k_low = K_nmp_low;
nmp.k_mid = K_nmp_mid;
nmp.k_high = K_nmp_high;
payload.nmp = nmp;

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif

fputs(fid, jsonencode(payload));
fclose(fid);

printf("Wrote %s\n", out_file);
