#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from bootstrap import DEFAULT_READYZ_URL, linux_preflight, start, stop
from common import DeveloperRuntimeError, authority_id, redact
from credential import install_credential, load_credential
from policy import POLICY_PATH, load_and_validate
from shared_mount import read_blob_with_evidence, shared_status, summarize_transfers


def checkout_from_args(args: argparse.Namespace) -> Path:
    return Path(args.checkout).resolve() if getattr(args, "checkout", None) else Path.cwd().resolve()


def main() -> int:
    parser = argparse.ArgumentParser(prog="act-runtime-dev")
    parser.add_argument("--checkout", help="repository checkout root")
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("validate-policy")
    commands.add_parser("install-credential")
    commands.add_parser("preflight")
    start_parser = commands.add_parser("start")
    start_parser.add_argument("--readyz-url", default=DEFAULT_READYZ_URL)
    commands.add_parser("stop")
    commands.add_parser("status")
    prove = commands.add_parser("prove-read")
    prove.add_argument("--digest", required=True)
    prove.add_argument("--source", required=True)

    args = parser.parse_args()
    checkout = checkout_from_args(args)
    try:
        if args.command == "validate-policy":
            load_and_validate(POLICY_PATH)
            print(json.dumps({"ok": True, "policy": str(POLICY_PATH)}, sort_keys=True))
        elif args.command == "install-credential":
            install_credential(checkout)
            print(json.dumps({"ok": True, "principal": "act-runtime-dev-read"}, sort_keys=True))
        elif args.command == "preflight":
            print(json.dumps({"ok": True, **linux_preflight(checkout)}, sort_keys=True))
        elif args.command == "start":
            start(checkout, args.readyz_url)
        elif args.command == "stop":
            stop(checkout)
            print(json.dumps({"ok": True, "stopped": True}, sort_keys=True))
        elif args.command == "status":
            credential = load_credential(checkout)
            print(json.dumps(shared_status(credential["accountId"]), sort_keys=True))
        elif args.command == "prove-read":
            credential = load_credential(checkout)
            mount_id = authority_id(credential["accountId"])
            data = read_blob_with_evidence(mount_id, args.digest, Path(args.source))
            summary = summarize_transfers(mount_id)
            print(json.dumps({
                "ok": True,
                "sha256": args.digest,
                "sizeBytes": len(data),
                "bodyTransfers": summary["bodyTransfers"].get(args.digest, 0),
                "cacheHits": summary["cacheHits"].get(args.digest, 0),
            }, sort_keys=True))
        else:
            parser.error("unknown command")
    except DeveloperRuntimeError as error:
        print("ERROR: %s" % redact(str(error)), file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001 - fail closed without leaking secrets
        print("ERROR: developer runtime adapter failed", file=sys.stderr)
        print(redact(str(error)), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
