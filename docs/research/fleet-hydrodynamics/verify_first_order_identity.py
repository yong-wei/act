"""实际BEM求解中注入输入文件变更，核验冻结哈希及失败状态。"""

import argparse
import contextlib
import io
import json
import os
import runpy
import sys
import tempfile
from pathlib import Path

import capytaine as cpt
from capytaine.io.mesh_writers import write_mesh

from build_destroyer_pack import sha256, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    source = Path(__file__).resolve().parents[1]/'capytaine-s175/solve_first_order.py'
    original_fill = cpt.BEMSolver.fill_dataset
    original_argv, original_directory = sys.argv, Path.cwd()
    cases = []
    for mutate in [False, True]:
        with tempfile.TemporaryDirectory(prefix='act-bem-identity-') as temporary:
            try:
                os.chdir(temporary)
                mesh = cpt.mesh_sphere(radius=2.0, center=(0.0, 0.0, -1.0), resolution=(8, 16)).immersed_part()
                write_mesh('mesh.dat', mesh.vertices, mesh.faces, file_format='nemoh')
                captured = sha256(Path('mesh.dat'))
                def fill(*positional, **keywords):
                    dataset = original_fill(*positional, **keywords)
                    if mutate:
                        path = Path('mesh.dat')
                        path.write_bytes(path.read_bytes()+b'\n')
                    return dataset
                cpt.BEMSolver.fill_dataset = fill
                sys.argv = [str(source), '--mesh', 'mesh.dat', '--mesh-format', 'nemoh',
                    '--name', 'input-identity-sphere', '--center-of-mass', '0', '0', '-1',
                    '--frequencies', '0.5', '--headings-deg', '0', '--output', 'result']
                exit_code = 0
                with contextlib.redirect_stdout(io.StringIO()):
                    try:
                        runpy.run_path(str(source), run_name='__main__')
                    except SystemExit as error:
                        exit_code = int(error.code)
                proof = json.loads(Path('result/provenance.json').read_text())
                expected_drift = ['mesh.dat'] if mutate else []
                if (proof['input_drift'] != expected_drift or exit_code != int(mutate)
                        or proof['status'] != ('failed' if mutate else 'computed')
                        or proof['mesh_sha256'] != captured or proof['generator_sha256'] != sha256(source)):
                    raise ValueError('实际求解输入冻结或漂移失败状态不符')
                cases.append({'mutation_injected': mutate, 'exit_code': exit_code,
                    'status': proof['status'], 'input_drift': proof['input_drift'],
                    'captured_mesh_sha256': captured, 'final_mesh_sha256': sha256(Path('mesh.dat')),
                    'solver': proof['solver'], 'output_sha256': proof['output_sha256']})
            finally:
                os.chdir(original_directory)
                sys.argv = original_argv
                cpt.BEMSolver.fill_dataset = original_fill
    report = {'schema': 'act.bem-input-identity-validation.v1', 'status': 'passed',
        'generator_sha256': sha256(Path(__file__)), 'solver_generator_sha256': sha256(source), 'cases': cases}
    output.parent.mkdir(parents=True, exist_ok=True)
    write_json(output, report)
    print(json.dumps({'status': 'passed', 'clean_exit_code': cases[0]['exit_code'],
        'mutated_exit_code': cases[1]['exit_code'], 'drift_detected': cases[1]['input_drift']}))


if __name__ == '__main__':
    main()
