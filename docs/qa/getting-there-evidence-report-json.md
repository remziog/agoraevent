# QA Evidence Validation — JSON Report Schema (`--report-json`)

`scripts/qa/collect-getting-there-evidence.py --validate [--all] --report-json <path>`
writes a machine-readable JSON report describing the result of validating one
or more "Getting There" evidence sessions under `docs/qa/evidence/`.

The schema is **stable** and versioned via the top-level `schema_version` field.
Breaking changes bump that integer. CI consumers should pin against a known
version.

> Current `schema_version`: **1**
>
> Formal JSON Schema (Draft 2020-12): [`docs/qa/schemas/evidence-validation-report.schema.json`](./schemas/evidence-validation-report.schema.json).
> Validate locally with `python scripts/qa/validate-report-schema.py <report.json>` (requires `pip install jsonschema`).
> CI runs this validator on every PR — schema regressions fail the build.

## Generating a report

```bash
# Validate every session and emit both Markdown and JSON reports,
# including git diff output vs origin/main.
python scripts/qa/collect-getting-there-evidence.py \
  --validate --all \
  --report      .qa-report/evidence-validation-report.md \
  --report-json .qa-report/evidence-validation-report.json \
  --base-ref    origin/main
```

`--report-json` requires `--validate`. `--base-ref` is optional; when set,
each session entry includes a `diff` string.

The script exits with `0` when every validated session passes, and `1` when
any session fails. The JSON report is written regardless of exit code (so CI
can upload it on failure).

## Top-level shape

```jsonc
{
  "schema_version": 1,
  "generated_at": "<ISO-8601 UTC timestamp>",
  "base_ref": "<string|null>",
  "summary":  { ... },
  "sessions": [ { ... }, ... ]
}
```

| Field            | Type              | Notes                                                                 |
| ---------------- | ----------------- | --------------------------------------------------------------------- |
| `schema_version` | integer           | Always `1` for this version. Bumped on breaking changes.              |
| `generated_at`   | string (ISO 8601) | UTC, seconds precision, e.g. `"2026-05-30T08:51:05+00:00"`.           |
| `base_ref`       | string \| null    | The `--base-ref` value (e.g. `"origin/main"`), or `null` if not set.  |
| `summary`        | object            | Aggregate counts across all sessions. See [Summary](#summary).        |
| `sessions`       | array of objects  | One entry per validated session folder. See [Session](#session).      |

### Summary

```jsonc
"summary": {
  "sessions":       2,
  "passing":        1,
  "failing":        1,
  "total_errors":   3,
  "total_warnings": 1,
  "result":         "FAIL"
}
```

| Field            | Type    | Notes                                                                  |
| ---------------- | ------- | ---------------------------------------------------------------------- |
| `sessions`       | integer | Number of session folders validated. `0` when no sessions exist.       |
| `passing`        | integer | Sessions with `exit_code == 0`.                                        |
| `failing`        | integer | Sessions with `exit_code != 0`.                                        |
| `total_errors`   | integer | Sum of `errors.length` across all sessions.                            |
| `total_warnings` | integer | Sum of `warnings.length` across all sessions.                          |
| `result`         | string  | `"PASS"` when `failing == 0`, otherwise `"FAIL"`.                      |

### Session

```jsonc
{
  "path":      "docs/qa/evidence/2026-05-30-a1b2c3d",
  "name":      "2026-05-30-a1b2c3d",
  "status":    "FAIL",
  "exit_code": 1,
  "errors":   ["ios-safari/granted: missing 10-permission-prompt.png", ...],
  "warnings": ["android-emulator/denied: notes.md is empty"],
  "diff":     "$ git diff --stat origin/main -- docs/qa/evidence/...\n ..."
}
```

| Field       | Type             | Notes                                                                                              |
| ----------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `path`      | string           | Repo-relative POSIX path to the session folder.                                                    |
| `name`      | string           | Session folder name, matches `YYYY-MM-DD-<7-hex>[-rN]`.                                            |
| `status`    | string           | `"PASS"` or `"FAIL"`, mirrors `exit_code == 0`.                                                    |
| `exit_code` | integer          | `0` on pass, `1` on validation errors. (Reserved: `2` for structural errors detected pre-validation.) |
| `errors`    | array of strings | Human-readable error messages. Empty when `status == "PASS"`.                                      |
| `warnings`  | array of strings | Non-blocking advisories. May be non-empty even when `status == "PASS"`.                            |
| `diff`      | string \| null   | **Only present when `base_ref` is set.** Output of `git diff --stat` + `--name-status` scoped to the session folder, or `null` if the diff command failed or returned nothing. |

Notes:
- Field order in JSON output is stable but consumers should not rely on it.
- Unknown future fields may be added within `schema_version: 1` in a
  backwards-compatible way. Consumers should ignore unknown fields.
- Removals or type changes will bump `schema_version`.

## Example: passing run, no sessions

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-30T08:51:05+00:00",
  "base_ref": null,
  "summary": {
    "sessions": 0,
    "passing": 0,
    "failing": 0,
    "total_errors": 0,
    "total_warnings": 0,
    "result": "PASS"
  },
  "sessions": []
}
```

## Example: mixed run with diff base

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-30T09:14:22+00:00",
  "base_ref": "origin/main",
  "summary": {
    "sessions": 2,
    "passing": 1,
    "failing": 1,
    "total_errors": 2,
    "total_warnings": 1,
    "result": "FAIL"
  },
  "sessions": [
    {
      "path": "docs/qa/evidence/2026-05-29-9f8e7d6",
      "name": "2026-05-29-9f8e7d6",
      "status": "PASS",
      "exit_code": 0,
      "errors": [],
      "warnings": ["physical-android/granted: notes.md is empty"],
      "diff": "$ git diff --stat origin/main -- docs/qa/evidence/2026-05-29-9f8e7d6\n ... 12 files changed, 0 insertions(+), 0 deletions(-)\n$ git diff --name-status origin/main -- docs/qa/evidence/2026-05-29-9f8e7d6\nA\tdocs/qa/evidence/2026-05-29-9f8e7d6/README.md\n..."
    },
    {
      "path": "docs/qa/evidence/2026-05-30-a1b2c3d",
      "name": "2026-05-30-a1b2c3d",
      "status": "FAIL",
      "exit_code": 1,
      "errors": [
        "ios-safari/granted: missing required file 10-permission-prompt.png",
        "ios-safari/granted: 20-map-opened.png is not a valid PNG (bad magic bytes)"
      ],
      "warnings": [],
      "diff": "$ git diff --stat origin/main -- docs/qa/evidence/2026-05-30-a1b2c3d\n ... 8 files changed, 0 insertions(+), 0 deletions(-)\n$ git diff --name-status origin/main -- docs/qa/evidence/2026-05-30-a1b2c3d\nA\tdocs/qa/evidence/2026-05-30-a1b2c3d/README.md\n..."
    }
  ]
}
```

## Consuming the report

Quick checks with `jq`:

```bash
# Overall pass/fail
jq -r '.summary.result' .qa-report/evidence-validation-report.json

# All failing session paths
jq -r '.sessions[] | select(.status=="FAIL") | .path' \
  .qa-report/evidence-validation-report.json

# Flatten every error as "<path>: <message>"
jq -r '.sessions[] | . as $s | $s.errors[] | "\($s.path): \(.)"' \
  .qa-report/evidence-validation-report.json
```

Pin the schema version in CI to fail loudly on a breaking bump:

```bash
ver=$(jq -r '.schema_version' .qa-report/evidence-validation-report.json)
[ "$ver" = "1" ] || { echo "Unexpected schema_version: $ver"; exit 1; }
```
