#!/usr/bin/env python3
"""Validate a JSON report produced by --report-json against its JSON Schema.

Usage:
  python scripts/qa/validate-report-schema.py <report.json> [schema.json]

Exits 0 on success, 1 on schema violation, 2 on usage errors.

Requires the `jsonschema` package (Draft 2020-12 support).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DEFAULT_SCHEMA = (
    Path(__file__).resolve().parents[2]
    / "docs" / "qa" / "schemas" / "evidence-validation-report.schema.json"
)


def main() -> int:
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print(__doc__, file=sys.stderr)
        return 2

    report_path = Path(sys.argv[1])
    schema_path = Path(sys.argv[2]) if len(sys.argv) == 3 else DEFAULT_SCHEMA

    if not report_path.is_file():
        print(f"error: report not found: {report_path}", file=sys.stderr)
        return 2
    if not schema_path.is_file():
        print(f"error: schema not found: {schema_path}", file=sys.stderr)
        return 2

    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        print("error: install with `pip install jsonschema`", file=sys.stderr)
        return 2

    report = json.loads(report_path.read_text(encoding="utf-8"))
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(report), key=lambda e: list(e.absolute_path))

    if not errors:
        print(f"OK: {report_path} matches schema_version "
              f"{report.get('schema_version')!r} ({schema_path.name})")
        return 0

    print(f"FAIL: {len(errors)} schema violation(s) in {report_path}:", file=sys.stderr)
    for err in errors:
        loc = "/".join(str(p) for p in err.absolute_path) or "<root>"
        print(f"  - {loc}: {err.message}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
