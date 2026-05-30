#!/usr/bin/env python3
"""Run JSON Schema fixtures against the report schema.

Every file under tests/report-schema/valid/ MUST validate.
Every file under tests/report-schema/invalid/ MUST be rejected.
Exits non-zero on any unexpected outcome — wired into CI so schema
regressions fail the build.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "docs/qa/getting-there-evidence-report.schema.json"
FIXTURES = Path(__file__).resolve().parent / "report-schema"


def check(path: Path) -> bool:
    """Return True if the fixture validates against the schema."""
    result = subprocess.run(
        ["check-jsonschema", "--schemafile", str(SCHEMA), str(path)],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> int:
    if not SCHEMA.exists():
        print(f"FATAL: schema not found at {SCHEMA}", file=sys.stderr)
        return 2

    valid_dir = FIXTURES / "valid"
    invalid_dir = FIXTURES / "invalid"
    valid_files = sorted(valid_dir.glob("*.json"))
    invalid_files = sorted(invalid_dir.glob("*.json"))

    if not valid_files or not invalid_files:
        print("FATAL: missing fixtures", file=sys.stderr)
        return 2

    failures: list[str] = []

    for f in valid_files:
        ok = check(f)
        status = "PASS" if ok else "FAIL"
        print(f"  [valid]   {status}  {f.relative_to(ROOT)}")
        if not ok:
            failures.append(f"valid fixture rejected: {f.relative_to(ROOT)}")

    for f in invalid_files:
        ok = check(f)
        # Inverted: invalid fixtures MUST fail validation.
        status = "PASS" if not ok else "FAIL"
        print(f"  [invalid] {status}  {f.relative_to(ROOT)}")
        if ok:
            failures.append(f"invalid fixture accepted: {f.relative_to(ROOT)}")

    print()
    print(f"Ran {len(valid_files)} valid + {len(invalid_files)} invalid fixtures.")
    if failures:
        print(f"\n{len(failures)} regression(s):")
        for msg in failures:
            print(f"  - {msg}")
        return 1
    print("All fixtures behaved as expected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
