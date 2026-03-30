export function calculateFirstOrderAnchorRatio(_timeConstant: number) {
  return Number((100 * (1 - Math.exp(-1))).toFixed(1));
}

function sanitizeZeta(zeta: number) {
  return Math.min(Math.max(zeta, 0.001), 0.999);
}

export function calculateDampedNaturalFrequency(wn: number, zeta: number) {
  return wn * Math.sqrt(Math.max(1 - sanitizeZeta(zeta) ** 2, 0.0001));
}

export function calculateRiseTime(wn: number, zeta: number) {
  const safeZeta = sanitizeZeta(zeta);
  const wd = calculateDampedNaturalFrequency(wn, safeZeta);
  return (Math.PI - Math.acos(safeZeta)) / wd;
}

export function calculatePeakTime(wn: number, zeta: number) {
  return Math.PI / calculateDampedNaturalFrequency(wn, zeta);
}

export function calculateOvershootPercent(zeta: number) {
  const safeZeta = sanitizeZeta(zeta);
  return Math.exp((-Math.PI * safeZeta) / Math.sqrt(Math.max(1 - safeZeta ** 2, 0.0001))) * 100;
}

export function calculateSettlingTime(wn: number, zeta: number, settlingBand: 2 | 5) {
  const coefficient = settlingBand === 2 ? 4 : 3;
  return coefficient / (sanitizeZeta(zeta) * wn);
}

export function solveSecondOrderWorkedExample({
  wn,
  zeta,
  settlingBand,
}: {
  wn: number;
  zeta: number;
  settlingBand: 2 | 5;
}) {
  const safeZeta = sanitizeZeta(zeta);
  const wd = calculateDampedNaturalFrequency(wn, safeZeta);
  const tr = calculateRiseTime(wn, safeZeta);
  const tp = calculatePeakTime(wn, safeZeta);
  const mpPercent = calculateOvershootPercent(safeZeta);
  const ts = calculateSettlingTime(wn, safeZeta, settlingBand);

  return {
    wn,
    zeta: safeZeta,
    wd,
    tr,
    tp,
    mpPercent,
    ts,
    sequence: ['read', 'wd', 'metrics'] as const,
  };
}
