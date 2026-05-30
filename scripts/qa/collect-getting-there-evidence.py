#!/usr/bin/env python3
"""
Evidence collection helper for the "Getting There" mobile QA.

Creates a canonical session folder under docs/qa/evidence/<DATE>-<SHORT_SHA>/
matching docs/qa/getting-there-evidence-naming.md, then walks you through
every required artifact for each platform/flow combination, prompting for the
source path of each file. Files are copied (not moved) into the session
folder under the exact required name.

Usage:
    python scripts/qa/collect-getting-there-evidence.py
    python scripts/qa/collect-getting-there-evidence.py --date 2026-05-30 --sha a1b2c3d
    python scripts/qa/collect-getting-there-evidence.py --only ios-safari
    python scripts/qa/collect-getting-there-evidence.py --only android-emulator:denied

At any prompt:
    <path>       copy file from <path> into the session folder under the canonical name
    s            skip this artifact (allowed only for files marked optional)
    q            quit (already-copied files are preserved)
"""

from __future__ import annotations

import argparse
import json
import datetime as dt
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_ROOT = REPO_ROOT / "docs" / "qa" / "evidence"

PLATFORMS = ["ios-safari", "android-emulator", "android-physical"]
FLOWS = ["granted", "denied"]


@dataclass(frozen=True)
class Artifact:
    ordinal: int
    slug: str
    ext: str
    description: str
    required: bool = True

    @property
    def filename(self) -> str:
        return f"{self.ordinal:02d}-{self.slug}.{self.ext}"


GRANTED_ARTIFACTS: list[Artifact] = [
    Artifact(1, "prompt",    "png", "OS / browser geolocation permission sheet"),
    Artifact(2, "maps-url",  "png", "Maps URL with origin=<lat>,<lng>&travelmode=transit"),
    Artifact(3, "console",   "txt", "Browser console dump (zero error-level entries)"),
    Artifact(4, "network",   "har", "DevTools HAR export", required=False),
]

DENIED_ARTIFACTS: list[Artifact] = [
    Artifact(1, "prompt",        "png", "OS / browser geolocation permission sheet"),
    Artifact(2, "fallback-note", "png", "App screenshot with gettingThere.deniedNote visible"),
    Artifact(3, "maps-url",      "png", "Fallback Maps URL with NO origin= parameter"),
    Artifact(4, "console",       "txt", "Browser console dump (zero error-level entries)"),
    Artifact(5, "network",       "har", "DevTools HAR export", required=False),
]

FLOW_ARTIFACTS: dict[str, list[Artifact]] = {
    "granted": GRANTED_ARTIFACTS,
    "denied":  DENIED_ARTIFACTS,
}


def short_git_sha() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short=7", "HEAD"],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL,
        )
        return out.decode().strip()
    except Exception:
        return "nogit000"


def ensure_session_dir(date: str, sha: str) -> Path:
    base = EVIDENCE_ROOT / f"{date}-{sha}"
    suffix_idx = 0
    target = base
    # If a run with the same date+sha already exists and contains files, suffix it.
    while target.exists() and any(target.rglob("*")) and not target.joinpath(".collect-resume").exists():
        suffix_idx += 1
        target = base.with_name(f"{base.name}-r{suffix_idx + 1}")
    target.mkdir(parents=True, exist_ok=True)
    target.joinpath(".collect-resume").touch()
    for platform in PLATFORMS:
        for flow in FLOWS:
            (target / platform / flow).mkdir(parents=True, exist_ok=True)
    return target


README_TEMPLATE = """# Evidence session {session}

- Tester: {tester}
- Commit SHA: {sha}
- Build URL: https://id-preview--0d3101bb-9764-405c-8d64-1cd8781cef23.lovable.app
- Event under test: {event}
- GPS seed: 41.0086, 28.9802 (Sultanahmet)

## Platforms

- iOS Safari: <device / iOS version>
- Android Emulator: <AVD / API level>
- Android physical: <make/model / Android version / Chrome version>

## Cross-platform matrix

All 14 rows passed: <yes / no — link to discrepancy notes>

## Known deviations from the standard

<None / list any optional files added or skipped>
"""


def write_readme(session_dir: Path, tester: str, sha: str, event: str) -> None:
    readme = session_dir / "README.md"
    if readme.exists():
        return
    readme.write_text(README_TEMPLATE.format(
        session=session_dir.name, tester=tester or "<name>",
        sha=sha, event=event or "Hagia Sophia (id: <uuid>)",
    ), encoding="utf-8")


def parse_only(only: str | None) -> list[tuple[str, str]]:
    targets: list[tuple[str, str]] = [(p, f) for p in PLATFORMS for f in FLOWS]
    if not only:
        return targets
    filters = [s.strip() for s in only.split(",") if s.strip()]
    keep: list[tuple[str, str]] = []
    for f in filters:
        if ":" in f:
            p, fl = f.split(":", 1)
        else:
            p, fl = f, None
        if p not in PLATFORMS:
            sys.exit(f"--only: unknown platform '{p}'. Valid: {', '.join(PLATFORMS)}")
        if fl is not None and fl not in FLOWS:
            sys.exit(f"--only: unknown flow '{fl}'. Valid: {', '.join(FLOWS)}")
        for plat, flow in targets:
            if plat == p and (fl is None or flow == fl):
                keep.append((plat, flow))
    return keep


def prompt_file(dest: Path, artifact: Artifact, platform: str, flow: str) -> str:
    """Returns 'copied', 'skipped', or 'quit'."""
    if dest.exists():
        print(f"  [✓] {dest.name} already present — keeping existing file")
        return "copied"
    label = "REQUIRED" if artifact.required else "optional"
    print(f"\n  {platform}/{flow}/{dest.name}  ({label})")
    print(f"    {artifact.description}")
    while True:
        raw = input("    source path (or 's' to skip, 'q' to quit): ").strip()
        if raw == "q":
            return "quit"
        if raw == "s":
            if artifact.required:
                print("    ! cannot skip a required artifact — provide a path or 'q' to quit")
                continue
            print("    [-] skipped")
            return "skipped"
        if raw.startswith("~"):
            raw = str(Path(raw).expanduser())
        src = Path(raw)
        if not src.is_file():
            print(f"    ! not a file: {src}")
            continue
        if src.suffix.lower().lstrip(".") != artifact.ext:
            print(f"    ! extension mismatch: expected .{artifact.ext}, got {src.suffix or '<none>'}")
            # offer to continue anyway
            if input("    copy anyway with renamed extension? [y/N]: ").strip().lower() != "y":
                continue
        shutil.copy2(src, dest)
        print(f"    [✓] copied → {dest.relative_to(REPO_ROOT)}")
        return "copied"


def verify_session(session_dir: Path) -> tuple[int, int]:
    """Returns (missing_required, present_total)."""
    missing = 0
    present = 0
    print("\n=== Verification ===")
    for platform in PLATFORMS:
        for flow in FLOWS:
            flow_dir = session_dir / platform / flow
            for art in FLOW_ARTIFACTS[flow]:
                target = flow_dir / art.filename
                if target.exists():
                    present += 1
                elif art.required:
                    missing += 1
                    print(f"  MISSING (required): {target.relative_to(REPO_ROOT)}")
    if missing == 0:
        print(f"  All required artifacts present ({present} files total).")
    else:
        print(f"  {missing} required artifact(s) missing — session is incomplete.")
    return missing, present


# ---- Strict validation -------------------------------------------------------

MAGIC_BYTES: dict[str, bytes] = {
    "png": b"\x89PNG\r\n\x1a\n",
}

# Filenames that are allowed inside a flow folder beyond the required/optional set.
EXTRA_ALLOWED_FILES = {"notes.md"}
EXTRA_ALLOWED_PREFIX_ORDINAL = 90  # 90+ ordinals are reserved for free-form extras


def _validate_file_content(path: Path, ext: str) -> str | None:
    """Return an error string, or None if the file's bytes look right."""
    try:
        if path.stat().st_size == 0:
            return "file is empty"
        if ext in MAGIC_BYTES:
            with path.open("rb") as fh:
                head = fh.read(len(MAGIC_BYTES[ext]))
            if head != MAGIC_BYTES[ext]:
                return f"bytes do not start with the {ext.upper()} magic signature"
        if ext == "txt":
            # Must be valid UTF-8
            try:
                path.read_text(encoding="utf-8")
            except UnicodeDecodeError as e:
                return f"not valid UTF-8 ({e.reason})"
        if ext == "har":
            import json
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                return f"not valid JSON ({e.msg})"
            if not isinstance(data, dict) or "log" not in data:
                return "missing top-level 'log' key (not a HAR file)"
    except OSError as e:
        return f"cannot read file: {e}"
    return None


def _validate_flow_dir(flow_dir: Path, artifacts: list[Artifact], errors: list[str], warnings: list[str]) -> None:
    rel = flow_dir.relative_to(REPO_ROOT)
    expected_by_name = {a.filename: a for a in artifacts}

    # 1. required + optional artifacts: presence, slug, ext, content
    for art in artifacts:
        path = flow_dir / art.filename
        if not path.exists():
            (errors if art.required else warnings).append(
                f"{rel}/{art.filename}: " + ("MISSING required artifact" if art.required else "optional artifact not provided")
            )
            continue
        if not path.is_file():
            errors.append(f"{rel}/{art.filename}: exists but is not a regular file")
            continue
        actual_ext = path.suffix.lower().lstrip(".")
        if actual_ext != art.ext:
            errors.append(f"{rel}/{art.filename}: extension '.{actual_ext}' does not match required '.{art.ext}'")
            continue
        content_err = _validate_file_content(path, art.ext)
        if content_err:
            errors.append(f"{rel}/{art.filename}: {content_err}")

    # 2. stray files: anything in the flow folder that isn't a known artifact, notes.md, or 90+ extra
    if not flow_dir.exists():
        return
    for entry in sorted(flow_dir.iterdir()):
        if not entry.is_file():
            errors.append(f"{rel}/{entry.name}: unexpected non-file entry in flow folder")
            continue
        name = entry.name
        if name in expected_by_name or name in EXTRA_ALLOWED_FILES:
            continue
        # Allow 90+ ordinals: NN-slug.ext where NN >= 90
        parts = name.split("-", 1)
        if len(parts) == 2 and parts[0].isdigit() and len(parts[0]) == 2 and int(parts[0]) >= EXTRA_ALLOWED_PREFIX_ORDINAL:
            # Loose slug check: kebab-case lowercase ASCII before the dot
            slug_and_ext = parts[1]
            if "." not in slug_and_ext:
                errors.append(f"{rel}/{name}: extra file missing extension")
                continue
            slug, ext = slug_and_ext.rsplit(".", 1)
            if not slug or not slug.replace("-", "").isalnum() or slug.lower() != slug:
                errors.append(f"{rel}/{name}: extra file slug must be lowercase kebab-case ASCII")
            if ext.lower() != ext:
                errors.append(f"{rel}/{name}: extension must be lowercase")
            continue
        # Otherwise it's a naming-standard violation
        errors.append(
            f"{rel}/{name}: filename does not match the standard "
            f"(expected one of: {', '.join(sorted(expected_by_name))}, notes.md, or 90+ extras)"
        )


def validate_session(session_dir: Path) -> tuple[int, list[str], list[str]]:
    """Strict validation. Returns (exit_code, errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []

    # Session folder name must match <YYYY-MM-DD>-<SHORT_SHA> (optionally with -rN)
    import re
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-[0-9a-f]{7}(?:-r\d+)?", session_dir.name):
        errors.append(f"{session_dir.relative_to(REPO_ROOT)}: folder name does not match <YYYY-MM-DD>-<SHORT_SHA>[-rN]")

    if not (session_dir / "README.md").is_file():
        errors.append(f"{session_dir.relative_to(REPO_ROOT)}/README.md: missing session README")

    # Platform folder names must be the exact fixed set
    actual_platforms = {p.name for p in session_dir.iterdir() if p.is_dir()}
    unexpected = actual_platforms - set(PLATFORMS)
    if unexpected:
        errors.append(f"{session_dir.relative_to(REPO_ROOT)}: unexpected platform folder(s): {', '.join(sorted(unexpected))}")
    missing_platforms = set(PLATFORMS) - actual_platforms
    if missing_platforms:
        errors.append(f"{session_dir.relative_to(REPO_ROOT)}: missing platform folder(s): {', '.join(sorted(missing_platforms))}")

    for platform in PLATFORMS:
        platform_dir = session_dir / platform
        if not platform_dir.is_dir():
            continue
        actual_flows = {p.name for p in platform_dir.iterdir() if p.is_dir()}
        unexpected_flows = actual_flows - set(FLOWS)
        if unexpected_flows:
            errors.append(f"{platform_dir.relative_to(REPO_ROOT)}: unexpected flow folder(s): {', '.join(sorted(unexpected_flows))}")
        for flow in FLOWS:
            flow_dir = platform_dir / flow
            if not flow_dir.is_dir():
                errors.append(f"{flow_dir.relative_to(REPO_ROOT)}: missing flow folder")
                continue
            _validate_flow_dir(flow_dir, FLOW_ARTIFACTS[flow], errors, warnings)

    print("\n=== Strict validation ===")
    if warnings:
        print(f"\nWarnings ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
        print("\nResult: FAIL — session is not acceptable.")
        return 1, errors, warnings
    print(f"\nResult: PASS — all required artifacts present, correctly named, and content-valid.")
    return 0, errors, warnings


def _git_diff_for_session(session_dir: Path, base_ref: str) -> str | None:
    """Returns the unified diff stat + name-status for the session dir vs base_ref, or None on failure."""
    try:
        rel = session_dir.relative_to(REPO_ROOT).as_posix()
        stat = subprocess.check_output(
            ["git", "diff", "--stat", base_ref, "--", rel],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL,
        ).decode()
        names = subprocess.check_output(
            ["git", "diff", "--name-status", base_ref, "--", rel],
            cwd=REPO_ROOT, stderr=subprocess.DEVNULL,
        ).decode()
        if not stat.strip() and not names.strip():
            return None
        return f"$ git diff --stat {base_ref} -- {rel}\n{stat}\n$ git diff --name-status {base_ref} -- {rel}\n{names}"
    except Exception:
        return None


def write_report(report_path: Path, results: list[tuple[Path, int, list[str], list[str]]], base_ref: str | None) -> None:
    """Write a Markdown validation report covering one or more sessions."""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    lines.append("# QA Evidence Validation Report")
    lines.append("")
    lines.append(f"Generated: {dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')}")
    lines.append(f"Sessions validated: **{len(results)}**")
    fail_count = sum(1 for _, rc, _, _ in results if rc != 0)
    lines.append(f"Result: **{'FAIL' if fail_count else 'PASS'}** ({fail_count} failing session(s))")
    if base_ref:
        lines.append(f"Diff base: `{base_ref}`")
    lines.append("")
    for session_dir, rc, errors, warnings in results:
        rel = session_dir.relative_to(REPO_ROOT).as_posix()
        status = "PASS" if rc == 0 else "FAIL"
        lines.append(f"## `{rel}` — {status}")
        lines.append("")
        if errors:
            lines.append(f"### Errors ({len(errors)})")
            lines.append("")
            for e in errors:
                lines.append(f"- {e}")
            lines.append("")
        if warnings:
            lines.append(f"### Warnings ({len(warnings)})")
            lines.append("")
            for w in warnings:
                lines.append(f"- {w}")
            lines.append("")
        if base_ref:
            diff = _git_diff_for_session(session_dir, base_ref)
            if diff:
                lines.append("### Diff vs base")
                lines.append("")
                lines.append("```")
                lines.append(diff.strip())
                lines.append("```")
                lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nReport written: {report_path}")


def write_report_json(
    report_path: Path,
    results: list[tuple[Path, int, list[str], list[str]]],
    base_ref: str | None,
) -> None:
    """Write a machine-readable JSON validation report.

    Schema (stable, intended for CI consumers):
      {
        "schema_version": 1,
        "generated_at": "<iso-8601 UTC>",
        "base_ref": "<str|null>",
        "summary": {
          "sessions": <int>,
          "passing": <int>,
          "failing": <int>,
          "total_errors": <int>,
          "total_warnings": <int>,
          "result": "PASS"|"FAIL"
        },
        "sessions": [
          {
            "path": "<repo-relative posix>",
            "name": "<folder name>",
            "status": "PASS"|"FAIL",
            "exit_code": <int>,
            "errors": [<str>, ...],
            "warnings": [<str>, ...],
            "diff": "<str|null>"   # present only when base_ref is set
          }, ...
        ]
      }
    """
    report_path.parent.mkdir(parents=True, exist_ok=True)
    sessions_out: list[dict] = []
    total_errors = 0
    total_warnings = 0
    failing = 0
    for session_dir, rc, errors, warnings in results:
        total_errors += len(errors)
        total_warnings += len(warnings)
        if rc != 0:
            failing += 1
        entry: dict = {
            "path": session_dir.relative_to(REPO_ROOT).as_posix(),
            "name": session_dir.name,
            "status": "PASS" if rc == 0 else "FAIL",
            "exit_code": rc,
            "errors": list(errors),
            "warnings": list(warnings),
        }
        if base_ref:
            entry["diff"] = _git_diff_for_session(session_dir, base_ref)
        sessions_out.append(entry)

    payload = {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "base_ref": base_ref,
        "summary": {
            "sessions": len(results),
            "passing": len(results) - failing,
            "failing": failing,
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "result": "FAIL" if failing else "PASS",
        },
        "sessions": sessions_out,
    }
    report_path.write_text(
        json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )
    print(f"JSON report written: {report_path}")





def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--date", default=dt.date.today().isoformat(), help="ISO date (default: today)")
    parser.add_argument("--sha", default=short_git_sha(), help="Short commit SHA (default: git HEAD)")
    parser.add_argument("--tester", default="", help="Tester name for README")
    parser.add_argument("--event", default="", help="Event name + id for README")
    parser.add_argument("--only", default=None,
                        help="Comma-separated targets: platform or platform:flow "
                             "(e.g. 'ios-safari', 'android-emulator:denied')")
    parser.add_argument("--verify-only", action="store_true",
                        help="Skip prompts; just verify required files are present")
    parser.add_argument("--validate", action="store_true",
                        help="Skip prompts; run STRICT validation: presence, slug, "
                             "extension, content magic-bytes, no stray files. "
                             "Exit code 1 on any error. Use this as the merge gate.")
    parser.add_argument("--all", action="store_true",
                        help="With --validate or --verify-only, validate every session "
                             "folder under docs/qa/evidence/ instead of a single one.")
    parser.add_argument("--report", default=None,
                        help="With --validate, also write a Markdown validation report "
                             "covering all validated sessions to this path.")
    parser.add_argument("--report-json", default=None,
                        help="With --validate, also write a machine-readable JSON "
                             "validation report (stable schema) to this path. Useful "
                             "for CI consumers that need to parse results programmatically.")
    parser.add_argument("--base-ref", default=None,
                        help="With --report or --report-json, include `git diff` output "
                             "vs this ref (e.g. 'origin/main') for each session.")
    args = parser.parse_args()

    # --validate and --verify-only operate on existing folders and never rotate.
    if args.validate or args.verify_only:
        results: list[tuple[Path, int, list[str], list[str]]] = []

        if args.all:
            if not EVIDENCE_ROOT.is_dir() or not any(EVIDENCE_ROOT.iterdir() if EVIDENCE_ROOT.is_dir() else []):
                print(f"No session folders under {EVIDENCE_ROOT.relative_to(REPO_ROOT)} — nothing to validate.")
                if args.report and args.validate:
                    write_report(Path(args.report), [], args.base_ref)
                if args.report_json and args.validate:
                    write_report_json(Path(args.report_json), [], args.base_ref)
                return 0
            sessions = sorted(p for p in EVIDENCE_ROOT.iterdir() if p.is_dir())
        else:
            session_dir = EVIDENCE_ROOT / f"{args.date}-{args.sha}"
            if not session_dir.is_dir():
                print(f"error: session folder does not exist: {session_dir.relative_to(REPO_ROOT)}")
                return 2
            sessions = [session_dir]

        overall = 0
        for s in sessions:
            print(f"\n############ {s.relative_to(REPO_ROOT)} ############")
            if args.validate:
                rc, errs, warns = validate_session(s)
                results.append((s, rc, errs, warns))
            else:
                missing, _ = verify_session(s)
                rc = 1 if missing else 0
            overall = overall or rc

        if len(sessions) > 1:
            print(f"\n{'PASS' if overall == 0 else 'FAIL'}: validated {len(sessions)} session(s).")

        if args.report and args.validate:
            write_report(Path(args.report), results, args.base_ref)

        return overall


    session_dir = ensure_session_dir(args.date, args.sha)
    write_readme(session_dir, args.tester, args.sha, args.event)
    print(f"Session folder: {session_dir.relative_to(REPO_ROOT)}")



    targets = parse_only(args.only)
    print(f"Collecting for: {', '.join(f'{p}/{f}' for p, f in targets)}\n")

    quit_early = False
    for platform, flow in targets:
        if quit_early:
            break
        print(f"\n--- {platform} / {flow} ---")
        for art in FLOW_ARTIFACTS[flow]:
            dest = session_dir / platform / flow / art.filename
            result = prompt_file(dest, art, platform, flow)
            if result == "quit":
                quit_early = True
                break

    # After interactive collection, run strict validation as the final word.
    code, _, _ = validate_session(session_dir)
    print(f"\nNext: fill in {session_dir.relative_to(REPO_ROOT)}/README.md")
    return code




if __name__ == "__main__":
    sys.exit(main())
