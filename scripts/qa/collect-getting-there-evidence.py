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
                        help="Skip prompts; just verify an existing session folder")
    args = parser.parse_args()

    session_dir = ensure_session_dir(args.date, args.sha)
    write_readme(session_dir, args.tester, args.sha, args.event)
    print(f"Session folder: {session_dir.relative_to(REPO_ROOT)}")

    if args.verify_only:
        missing, _ = verify_session(session_dir)
        return 1 if missing else 0

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

    missing, _ = verify_session(session_dir)
    print(f"\nNext: fill in {session_dir.relative_to(REPO_ROOT)}/README.md")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
