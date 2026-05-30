# Report schema fixtures

JSON fixtures that lock in the behaviour of
`docs/qa/getting-there-evidence-report.schema.json`.

Run locally:

```bash
pip install check-jsonschema
python scripts/qa/tests/run_schema_fixtures.py
```

CI runs this on every PR (see `.github/workflows/qa-evidence-validation.yml`)
so schema regressions fail the build.

## Layout

- `valid/` — payloads that MUST validate. Add a fixture here whenever you
  intentionally widen the schema (new optional field, new allowed enum
  value, etc.).
- `invalid/` — payloads that MUST be rejected. Add a fixture here for every
  constraint worth defending. Each file targets one specific constraint
  (filename describes which).

## Adding a fixture

1. Drop the JSON file in the right folder.
2. Re-run `python scripts/qa/tests/run_schema_fixtures.py`.
3. If a new `invalid/` fixture is *accepted*, tighten the schema until it's
   rejected. If a new `valid/` fixture is *rejected*, loosen the schema or
   fix the fixture.

Keep one constraint per `invalid/` fixture — that way the filename in CI
output points directly at the regression.
