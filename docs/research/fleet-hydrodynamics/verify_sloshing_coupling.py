"""以独立体积分核验矩形液舱模态质量、平移/转动耦合及自由液面修正。"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.special import roots_legendre

from build_destroyer_pack import sha256, write_json


def integrate_mode(width, span, fill, kg):
    density, gravity, bottom = 450.0, 9.81, 1.5
    depth = 26.0*fill
    nodes, weights = roots_legendre(80)
    across = nodes*width/2
    height = (nodes+1)*depth/2
    wave_number = math.pi/width
    derivative_horizontal = np.outer(np.cos(wave_number*across), np.cosh(wave_number*height)) / math.sinh(wave_number*depth)
    derivative_vertical = np.outer(np.sin(wave_number*across), np.sinh(wave_number*height)) / math.sinh(wave_number*depth)
    quadrature = np.outer(weights*width/2, weights*depth/2)
    translation = density*span*np.sum(derivative_horizontal*quadrature)
    rotation = density*span*np.sum((-(height[None, :]+bottom-kg)*derivative_horizontal
        + across[:, None]*derivative_vertical)*quadrature)
    modal_mass_integral = density*span*np.sum((derivative_horizontal**2+derivative_vertical**2)*quadrature)
    coupling = 2*density*span/wave_number**2
    modal_mass = density*span*width/(2*wave_number*math.tanh(wave_number*depth))
    omega_squared = gravity*wave_number*math.tanh(wave_number*depth)
    wall_pressure_depth = math.tanh(wave_number*depth/2)/wave_number
    effective_height = bottom+depth-2*wall_pressure_depth
    rotation_formula = coupling*(kg-effective_height)
    errors = {'translation_relative': float(translation/coupling-1),
        'rotation_relative': float(rotation/rotation_formula-1),
        'modal_mass_relative': float(modal_mass_integral/modal_mass-1)}
    if max(abs(value) for value in errors.values()) > 1e-11:
        raise ValueError(f'独立模态体积分校核失败 {errors}')
    return {'width_m': width, 'span_m': span, 'fill_ratio': fill, 'fill_depth_m': depth,
        'k_per_m': wave_number, 'omega_rad_s': math.sqrt(omega_squared), 'modal_mass_kg': modal_mass,
        'translation_coupling_kg': coupling, 'rotation_coupling_scalar_kg_m': rotation_formula,
        'equivalent_action_height_keel_up_m': effective_height,
        'wall_pressure_depth_below_surface_m': wall_pressure_depth,
        'convective_equivalent_mass_kg': coupling**2/modal_mass,
        'free_surface_stiffness_reduction_nm_per_rad': (coupling*gravity)**2/(modal_mass*omega_squared),
        'independent_integrals': {'translation_kg': float(translation), 'rotation_kg_m': float(rotation),
            'modal_mass_kg': float(modal_mass_integral), 'errors': errors}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--nasa-sp106', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--baseline-effective-gm-m', type=float,
                        help='已审定的基准有效GM，用于核验单一KG修订')
    args = parser.parse_args()
    geometry = json.loads(args.geometry.read_text())
    kg = geometry['kg_keel_up_m']
    modes = [integrate_mode(width, span, fill, kg)
        for fill in [0.30, 0.70, 0.85, 0.95] for width, span in [(38.0, 44.0), (44.0, 38.0)]]
    baseline = next(mode for mode in modes if mode['fill_ratio'] == 0.85 and mode['width_m'] == 38.0)
    correction = 4*baseline['free_surface_stiffness_reduction_nm_per_rad']/(geometry['displacement_mass_kg']*9.81)
    effective_gm = geometry['gm_transverse_m']-correction
    approved = args.baseline_effective_gm_m
    if approved is not None and (not math.isfinite(approved) or approved <= 0 or abs(effective_gm-approved) > 1e-10):
        raise ValueError('几何GM、模态自由液面修正与审定有效GM不一致')
    report = {'schema': 'act.sloshing-coupling.integral-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'geometry_sha256': sha256(args.geometry),
        'sources': ['https://ntrs.nasa.gov/citations/19670006555',
                    'https://www2.swri.org/www2/fluid-slosh/dodge-sp-106-update.pdf'],
        'nasa_sp106_sha256': sha256(args.nasa_sp106) if args.nasa_sp106 else None,
        'reference_kg_keel_up_m': kg, 'quadrature_points_per_axis': 80, 'modes': modes,
        'coupling_scope': 'first antisymmetric free-surface mode, frozen reference KG, independent potential-gradient volume integrals',
        'baseline_static_stability': {'mass_kg': geometry['displacement_mass_kg'],
            'geometric_gm_m': geometry['gm_transverse_m'], 'first_mode_free_surface_correction_m': correction,
            'effective_gm_m': effective_gm, 'status': 'not_ready' if effective_gm <= 0 else 'positive',
            'approved_effective_gm_m': approved,
            'authority_decision': 'effective GM interpretation supplied' if approved is not None
                else 'pending course-owner interpretation of prescribed baseline GM'},
        'scope_exclusions': ['time-domain coupled energy verification', 'vessel-calibrated benchmark'],
        'not_ready': ['baseline GM decision'] if approved is None else []}
    write_json(args.output, report)
    print(json.dumps({'status': report['status'], 'modes': len(modes),
        'free_surface_correction_m': correction, 'baseline_effective_gm_m': effective_gm}))


if __name__ == '__main__':
    main()
