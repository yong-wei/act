"""用解析箱体和倾斜水线校核三角裁切、遮挡合并及分块面积一阶矩。"""

import argparse
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

from build_destroyer_pack import sha256, write_json
from build_wind_projections import above_water, cells, silhouette


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    vertices = np.array([[-3, -2, -4], [3, -2, -4], [3, 2, -4], [-3, 2, -4],
                         [-3, -2, 2], [3, -2, 2], [3, 2, 2], [-3, 2, 2]], dtype=float)
    faces = np.array([[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
                      [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
                      [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])
    # 完全重合的三个物体仍只计一次受风投影。
    triangles = np.tile(vertices[faces], (3, 1, 1))
    records = []
    for pitch in [0.0, 0.1, -0.1]:
        wet_clipped = above_water(triangles, 0.0, pitch)
        for axis, axes in [(0, [1, 2]), (1, [0, 2])]:
            actual = silhouette(wet_clipped, axes)
            slope = np.tan(pitch)
            expected = (Polygon([[-2, -4], [2, -4], [2, abs(3*slope)], [-2, abs(3*slope)]])
                if axis == 0 else Polygon([[-3, -4], [3, -4], [3, 3*slope], [-3, -3*slope]]))
            area_error = abs(actual.area-expected.area)
            shape_error = actual.symmetric_difference(expected).area
            partition = cells(actual, axis, 0.7)
            area = sum(panel['projected_area_m2'] for panel in partition)
            moment = np.sum([np.array(panel['point_body_m'])*panel['projected_area_m2'] for panel in partition], axis=0)
            center = np.zeros(3)
            center[1-axis], center[2] = actual.centroid.x, actual.centroid.y
            first_moment_error = float(np.max(abs(moment-center*actual.area)))
            if max(area_error, shape_error) > 1e-6 or abs(area-actual.area) > 1e-10 or first_moment_error > 1e-10:
                raise ValueError('解析箱体投影或分块面积一阶矩不符')
            records.append({'pitch_rad': pitch, 'normal_axis': axis, 'area_m2': area,
                'area_error_m2': area_error, 'symmetric_difference_m2': shape_error,
                'first_moment_error_m3': first_moment_error})
    write_json(args.output, {'schema': 'act.wind-projection-analytic-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)),
        'projection_generator_sha256': sha256(Path(__file__).with_name('build_wind_projections.py')),
        'cases': records})
    print(json.dumps({'status': 'passed', 'cases': len(records), 'maximum_shape_error_m2': max(x['symmetric_difference_m2'] for x in records)}))


if __name__ == '__main__':
    main()
