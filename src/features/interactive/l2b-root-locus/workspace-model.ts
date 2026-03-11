export interface RootLocusPole {
  re: number;
  im: number;
}

export interface RootLocusMetrics {
  poles: RootLocusPole[];
  dampingRatio: number | null;
  overshoot: number | null;
  settlingTime: number | null;
}

export interface RootLocusSamplePoint {
  key: string;
  gain: number;
  pole: RootLocusPole;
  branch: 'upper' | 'lower' | 'real-left' | 'real-right';
  metrics: RootLocusMetrics;
}

export interface RootLocusResponsePoint {
  time: number;
  output: number;
}

const MIN_GAIN = 0;
const MAX_GAIN = 10;

export function clampGain(gain: number) {
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));
}

export function computeL2BMetrics(gain: number): RootLocusMetrics {
  const safeGain = clampGain(gain);
  if (safeGain <= 1) {
    const delta = Math.sqrt(Math.max(0, 1 - safeGain));
    return {
      poles: [
        { re: -1 + delta, im: 0 },
        { re: -1 - delta, im: 0 },
      ],
      dampingRatio: 1,
      overshoot: 0,
      settlingTime: 4,
    };
  }

  const imag = Math.sqrt(safeGain - 1);
  const zeta = 1 / Math.sqrt(1 + imag * imag);
  const overshoot = Math.exp((-zeta * Math.PI) / Math.sqrt(Math.max(1e-6, 1 - zeta * zeta))) * 100;
  return {
    poles: [
      { re: -1, im: imag },
      { re: -1, im: -imag },
    ],
    dampingRatio: zeta,
    overshoot,
    settlingTime: 4,
  };
}

export function buildRootLocusSamples(step = 0.25): RootLocusSamplePoint[] {
  const samples: RootLocusSamplePoint[] = [];
  for (let gain = MIN_GAIN; gain <= MAX_GAIN + 1e-6; gain += step) {
    const roundedGain = Number(gain.toFixed(2));
    const metrics = computeL2BMetrics(roundedGain);
    for (const pole of metrics.poles) {
      samples.push({
        key: `${roundedGain.toFixed(2)}:${pole.re.toFixed(3)}:${pole.im.toFixed(3)}`,
        gain: roundedGain,
        pole,
        branch:
          pole.im > 0 ? 'upper' : pole.im < 0 ? 'lower' : pole.re > -1 ? 'real-right' : 'real-left',
        metrics,
      });
    }
  }
  return samples;
}

export const ROOT_LOCUS_SAMPLES = buildRootLocusSamples();

export function getNearestRootLocusPoint(gain: number, preferredImag?: number) {
  const targetGain = clampGain(gain);
  let nearest = ROOT_LOCUS_SAMPLES[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const sample of ROOT_LOCUS_SAMPLES) {
    const imagBias = preferredImag == null ? 0 : Math.abs(sample.pole.im - preferredImag) * 0.08;
    const distance = Math.abs(sample.gain - targetGain) + imagBias;
    if (distance < nearestDistance) {
      nearest = sample;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getRootLocusSelection(key: string | null | undefined) {
  if (!key) {
    return null;
  }
  return ROOT_LOCUS_SAMPLES.find((sample) => sample.key === key) ?? null;
}

export function describePole(pole: RootLocusPole) {
  const imagAbs = Math.abs(pole.im);
  if (imagAbs < 1e-6) {
    return `${pole.re.toFixed(2)}`;
  }
  return `${pole.re.toFixed(2)} ${pole.im >= 0 ? '+' : '-'} ${imagAbs.toFixed(2)}j`;
}

export function buildResponseCurve(gain: number, totalTime = 8, samples = 40): RootLocusResponsePoint[] {
  const metrics = computeL2BMetrics(gain);
  const zeta = metrics.dampingRatio ?? 1;
  const poles = metrics.poles;
  const omegaN =
    poles.length > 1
      ? Math.sqrt(Math.max(1e-6, poles[0].re * poles[0].re + poles[0].im * poles[0].im))
      : 1;
  const omegaD = Math.max(1e-6, poles[0]?.im ? Math.abs(poles[0].im) : omegaN * Math.sqrt(Math.max(0, 1 - zeta * zeta)));

  return Array.from({ length: samples + 1 }, (_, index) => {
    const time = (totalTime / samples) * index;
    let output = 0;

    if (zeta >= 0.999) {
      output = 1 - Math.exp(-omegaN * time) * (1 + omegaN * time);
    } else {
      const theta = Math.atan2(Math.sqrt(Math.max(0, 1 - zeta * zeta)), zeta);
      output =
        1 -
        Math.exp(-zeta * omegaN * time) *
          (Math.sin(omegaD * time + theta) / Math.sqrt(Math.max(1e-6, 1 - zeta * zeta)));
    }

    return {
      time,
      output: Number(output.toFixed(4)),
    };
  });
}

export function toSvgPointX(re: number, width = 320) {
  const min = -2.4;
  const max = 0.6;
  return ((re - min) / (max - min)) * width;
}

export function toSvgPointY(im: number, height = 240) {
  const maxAbs = 3.2;
  return height / 2 - (im / maxAbs) * (height / 2 - 12);
}
