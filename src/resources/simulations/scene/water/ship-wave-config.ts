/** 视觉船行波的局部域；不参与船舶动力学。 */
export const SHIP_WAVE_DOMAIN_METERS = 768;
export const SHIP_WAVE_RESOLUTION = 512;
export const SHIP_WAVE_MIN_WAVELENGTH_METERS = 8;
export const SHIP_PRESSURE_SPEED_HEAD_SCALE = 0.10;

export function shipPressureShape(length: number, beam: number) {
  return { lengthSigma: Math.max(2, Math.min(9, length * 0.035)), beamSigma: Math.max(1.3, Math.min(6, beam * 0.23)),
    bowOffset: length * 0.42, sternOffset: -length * 0.40 };
}
