pkg load control

out_path = 'course-content/authoring/lessons/3-4/media/processed/3-4-generalized-root-locus-octave-native.png';

K_B = 0.6064;
B_poly = [1, 2.24375, 0.214375, 0.01715 * K_B];
A_poly = [3.43, 0.343, 0, 0];
Ge = tf(A_poly, B_poly);

fig = figure('visible', 'off');
set(fig, 'color', 'white', 'position', [100, 100, 980, 560]);

rlocus(Ge, 0.01, 0, 6);
grid on;
xlabel('Re(s)');
ylabel('Im(s)');
title('Octave native rlocus of generalized root locus');

print(fig, out_path, '-dpng', '-r220');
close(fig);
