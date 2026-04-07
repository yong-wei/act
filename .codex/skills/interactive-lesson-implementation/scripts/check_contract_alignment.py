from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_NODE_SCRIPT = REPO_ROOT / 'scripts' / 'tests' / 'test-interactive-contract-implementation-alignment.mjs'

LESSON_PRESETS = {
    '2-1': {
        'contract': 'course-content/authoring/lessons/2-1/design/interactive-contract.yaml',
        'implementation': 'src/lib/unit-2-1-course.ts',
        'page_contract_const': 'UNIT_2_1_PAGE_CONTRACTS',
        'step_const': 'UNIT_2_1_LESSON_STEPS',
    },
    '2-2': {
        'contract': 'course-content/authoring/lessons/2-2/design/interactive-contract.yaml',
        'implementation': 'src/lib/unit-2-2-course.ts',
        'page_contract_const': 'UNIT_2_2_PAGE_CONTRACTS',
        'step_const': 'UNIT_2_2_LESSON_STEPS',
    },
    '3-2': {
        'contract': 'course-content/authoring/lessons/3-2/design/interactive-contract.yaml',
        'implementation': 'src/lib/unit-3-2-course.ts',
        'page_contract_const': 'UNIT_3_2_PAGE_CONTRACTS',
        'step_const': 'UNIT_3_2_LESSON_STEPS',
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='检查互动课程作者态契约与本地实现平行契约是否一致。',
    )
    parser.add_argument('--lesson', help='课次编号；若存在预设，可直接使用。')
    parser.add_argument('--contract', help='作者态 interactive-contract.yaml 相对路径。')
    parser.add_argument('--implementation', help='实现侧 TypeScript 文件相对路径。')
    parser.add_argument('--page-contract-const', dest='page_contract_const', help='实现文件中的页面契约常量名。')
    parser.add_argument('--step-const', dest='step_const', help='实现文件中的步骤数组常量名。')
    parser.add_argument('--steps', help='可选，仅校验逗号分隔的部分步骤。')
    parser.add_argument(
        '--node-script',
        default=str(DEFAULT_NODE_SCRIPT.relative_to(REPO_ROOT)),
        help='底层 Node 校验脚本相对路径。',
    )
    return parser.parse_args()


def resolve_config(args: argparse.Namespace) -> dict[str, str]:
    config = {
        'contract': args.contract or '',
        'implementation': args.implementation or '',
        'page_contract_const': args.page_contract_const or '',
        'step_const': args.step_const or '',
    }

    if args.lesson and args.lesson in LESSON_PRESETS:
        preset = LESSON_PRESETS[args.lesson]
        for key, value in preset.items():
            if not config.get(key):
                config[key] = value

    missing = [key for key, value in config.items() if not value]
    if missing:
        joined = ', '.join(missing)
        raise SystemExit(
            f'缺少参数：{joined}。可直接使用预设课次，或显式传入 --contract / --implementation / --page-contract-const / --step-const。'
        )
    return config


def main() -> None:
    args = parse_args()
    config = resolve_config(args)

    command = [
        'node',
        str((REPO_ROOT / args.node_script).resolve()),
        '--contract',
        config['contract'],
        '--implementation',
        config['implementation'],
        '--pageContractConst',
        config['page_contract_const'],
        '--stepConst',
        config['step_const'],
    ]
    if args.steps:
        command.extend(['--steps', args.steps])

    print('Running:', ' '.join(command))
    completed = subprocess.run(
        command,
        cwd=str(REPO_ROOT),
        check=False,
        text=True,
        capture_output=True,
    )

    if completed.stdout:
        print(completed.stdout.rstrip())
    if completed.stderr:
        print(completed.stderr.rstrip(), file=sys.stderr)

    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


if __name__ == '__main__':
    main()
