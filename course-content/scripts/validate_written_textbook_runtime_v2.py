#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path

from structured_textbook_runtime import validate_written_export


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Validate cross-record closure for written textbook runtime v2 exports.',
    )
    parser.add_argument(
        '--runtime-dir',
        action='append',
        required=True,
        help='Written textbook runtime v2 directory to validate.',
    )
    args = parser.parse_args()

    try:
        for runtime_dir in args.runtime_dir:
            validate_written_export(Path(runtime_dir))
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps({
        'runtimeDirectories': len(args.runtime_dir),
        'failures': [],
    }, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
