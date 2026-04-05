pkg load control;

root_dir = fileparts(mfilename("fullpath"));
out_dir = fullfile(root_dir, "generated-data");
out_file = fullfile(out_dir, "3-7-design-data.json");

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

function out = poles_to_struct(values)
  out = struct();
  out.real = real(values(:))';
  out.imag = imag(values(:))';
endfunction

function out = rlocus_to_struct(sys, increment, kmin, kmax)
  [rldata, ~] = rlocus(sys, increment, kmin, kmax);
  out = complex_to_struct(rldata);
endfunction

function out = bode_to_struct(sys, omega)
  resp = squeeze(freqresp(sys, omega));
  out = struct();
  out.w = omega(:)';
  out.mag_db = (20 * log10(abs(resp(:))))';
  out.phase_deg = (unwrap(arg(resp(:)))' * 180 / pi);
endfunction

function out = step_metrics(sys, t)
  [y, t_out] = step(sys, t);
  y = y(:);
  t_out = t_out(:);
  y_final = y(end);
  tol = 0.02 * abs(y_final);
  ts = NaN;
  idx = find(abs(y - y_final) <= tol);
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
  out.overshoot = max((max(y) - y_final) / max(abs(y_final), eps) * 100, 0);
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

function out = ramp_error_to_struct(sys, t_end)
  t = linspace(0, t_end, t_end * 120 + 1)';
  r = t;
  y = lsim(sys, r, t);
  e = r - y;
  out = response_to_struct(t, e);
endfunction

s = tf("s");
G = 4 / (s * (s + 4));
w_dense = logspace(-2, 2, 900);
w_bode = logspace(-2, 2, 800);
t_long = linspace(0, 18, 18 * 120 + 1);
t_short = linspace(0, 12, 12 * 120 + 1);

payload = struct();

payload.specs = struct();
payload.specs.zeta_min = 0.456;
payload.specs.sigma_min = 0.333;
payload.specs.mp_max = 20.0;
payload.specs.ts2_max = 12.0;

% 图 1：PI / 滞后 / 超前低频补偿
lowfreq = struct();
lowfreq.pi = struct();
lowfreq.pi.bode = bode_to_struct((s + 0.5) / s, w_dense);
lowfreq.pi.zero = 0.5;
lowfreq.lag = struct();
lowfreq.lag.bode = bode_to_struct((5 * s + 1) / (50 * s + 1), w_dense);
lowfreq.lag.pole = 0.02;
lowfreq.lag.zero = 0.2;
lowfreq.lead = struct();
lowfreq.lead.bode = bode_to_struct((5 * s + 1) / (s + 1), w_dense);
lowfreq.lead.zero = 0.2;
lowfreq.lead.pole = 1.0;
payload.lowfreq = lowfreq;

% 图 2：纯增益与 PI 时域设计
pi_time = struct();
pi_time.pure = struct();
pi_time.pure.root_locus = rlocus_to_struct(G, 0.05, 0, 20);
pi_time.pure.open_loop_poles = [0, -4];
pi_time.pure.open_loop_zeros = [];
pi_time.pure.closed_loop_k10 = poles_to_struct(pole(feedback(10 * G, 1)));
pi_time.pure.k10_metrics = step_metrics(feedback(10 * G, 1), t_long);
pi_time.pure.step_k1 = step_metrics(feedback(G, 1), t_long).response;
pi_time.pure.step_k10 = pi_time.pure.k10_metrics.response;
pi_time.pure.ramp_error_k1 = ramp_error_to_struct(feedback(G, 1), 18);
pi_time.pure.ramp_error_k10 = ramp_error_to_struct(feedback(10 * G, 1), 18);
pi_time.pi = struct();
pi_time.pi.open_loop = (s + 0.3) / s * G;
pi_time.pi.root_locus = rlocus_to_struct(pi_time.pi.open_loop, 0.01, 0, 5);
pi_time.pi.open_loop_poles = [0, 0, -4];
pi_time.pi.open_loop_zeros = [-0.3];
pi_time.pi.closed_loop = feedback(1.0 * pi_time.pi.open_loop, 1);
pi_time.pi.closed_loop_poles = poles_to_struct(pole(pi_time.pi.closed_loop));
pi_time.pi.metrics = step_metrics(pi_time.pi.closed_loop, t_long);
pi_time.pi.ramp_error = ramp_error_to_struct(pi_time.pi.closed_loop, 18);
payload.pi_time = pi_time;

% 图 3：滞后校正时域设计
lag_time = struct();
lag_time.pure = pi_time.pure;
lag_time.lag = struct();
lag_time.lag.open_loop = (s + 0.2) / (s + 0.02) * G;
lag_time.lag.root_locus = rlocus_to_struct(lag_time.lag.open_loop, 0.05, 0, 20);
lag_time.lag.open_loop_poles = [0, -4, -0.02];
lag_time.lag.open_loop_zeros = [-0.2];
lag_time.lag.closed_loop = feedback(lag_time.lag.open_loop, 1);
lag_time.lag.closed_loop_poles = poles_to_struct(pole(lag_time.lag.closed_loop));
lag_time.lag.metrics = step_metrics(lag_time.lag.closed_loop, t_long);
lag_time.lag.ramp_error = ramp_error_to_struct(lag_time.lag.closed_loop, 18);
payload.lag_time = lag_time;

% 图 4：PI 频域设计
pi_freq = struct();
pi_freq.gain4 = struct();
pi_freq.gain4.open_loop = 4 * G;
pi_freq.gain4.bode = bode_to_struct(pi_freq.gain4.open_loop, w_bode);
pi_freq.gain4.step = step_metrics(feedback(pi_freq.gain4.open_loop, 1), t_long).response;
pi_freq.gain10 = struct();
pi_freq.gain10.open_loop = 10 * G;
pi_freq.gain10.bode = bode_to_struct(pi_freq.gain10.open_loop, w_bode);
pi_freq.gain10.step = step_metrics(feedback(pi_freq.gain10.open_loop, 1), t_long).response;
pi_freq.pi = struct();
pi_freq.pi.open_loop = 3 * (s + 0.125) / s * G;
pi_freq.pi.bode = bode_to_struct(pi_freq.pi.open_loop, w_bode);
pi_freq.pi.margins = margin_to_struct(pi_freq.pi.open_loop);
pi_freq.pi.metrics = step_metrics(feedback(pi_freq.pi.open_loop, 1), t_long);
payload.pi_freq = pi_freq;

% 图 5：PI 与 PD 对比
pi_pd = struct();
pi_pd.pi = struct();
pi_pd.pi.closed_loop = feedback(3 * (s + 0.125) / s * G, 1);
pi_pd.pi.metrics = step_metrics(pi_pd.pi.closed_loop, t_short);
pi_pd.pi.ramp_error = ramp_error_to_struct(pi_pd.pi.closed_loop, 12);
pi_pd.pi.margins = margin_to_struct(3 * (s + 0.125) / s * G);
pi_pd.pd = struct();
pi_pd.pd.open_loop = 8 * (1 + 0.1 * s) * G;
pi_pd.pd.closed_loop = feedback(pi_pd.pd.open_loop, 1);
pi_pd.pd.metrics = step_metrics(pi_pd.pd.closed_loop, t_short);
pi_pd.pd.ramp_error = ramp_error_to_struct(pi_pd.pd.closed_loop, 12);
pi_pd.pd.margins = margin_to_struct(pi_pd.pd.open_loop);
payload.pi_pd = pi_pd;

fid = fopen(out_file, "w");
if fid < 0
  error("Cannot open output file: %s", out_file);
endif

fputs(fid, jsonencode(payload));
fclose(fid);

printf("Wrote %s\n", out_file);
