% Octave design-data template for control-system media.
% Copy this file into a lesson media/raw directory and replace the placeholders.

pkg load control;

out_dir = fullfile(pwd, 'generated-data');
if exist(out_dir, 'dir') != 7
  mkdir(out_dir);
endif

% Define plant/controller/system here.
% Example:
% s = tf('s');
% G = 1 / (s^2 + 2*s + 1);

% Export numeric data with explicit column headers.
% csvwrite cannot write headers, so prefer fopen/fprintf for production data.
