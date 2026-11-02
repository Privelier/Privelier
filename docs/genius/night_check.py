"""The night-shift commit gate: every `npm run check` step, run on its own.

`npm run check` stops at its first failing step, and on this machine the
first step (tsc) always fails on the untracked artifacts/ build copy. This
runs all six steps and judges each one against the recorded baseline
(docs/genius/PROGRESS.md, "Check baseline"):

  typecheck  no error outside artifacts/
  lint       eslint . --max-warnings 0 passes
  jest       no failure beyond docs/genius/jest-baseline-failures.txt
  unused     knip passes
  dup        jscpd passes
  circular   madge passes

usage: python docs/genius/night_check.py [--skip-jest]
"""
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from jest_compare import BASELINE, failures  # noqa: E402


def run(cmd: str) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=ROOT, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return proc.returncode, proc.stdout + proc.stderr


def main() -> None:
    ok = True

    _, out = run("npx tsc --noEmit")
    errors = [line for line in out.splitlines() if re.match(r"^\S+\(\d+,\d+\): error", line) and not line.startswith("artifacts/")]
    print(f"typecheck  {'ok' if not errors else 'FAIL'}")
    for line in errors:
        print("   ", line)
    ok &= not errors

    for name, cmd in (("lint", "npm run lint"), ("unused", "npm run unused"), ("dup", "npm run dup"), ("circular", "npm run circular")):
        code, out = run(cmd)
        print(f"{name:<10} {'ok' if code == 0 else 'FAIL'}")
        if code != 0:
            print(out[-3000:])
        ok &= code == 0

    if "--skip-jest" not in sys.argv:
        _, out = run("npm test -- --silent")
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as handle:
            handle.write(out)
        got = failures(handle.name)
        base = set(BASELINE.read_text(encoding="utf-8").splitlines())
        new = sorted(got - base)
        totals = [line for line in out.splitlines() if line.startswith(("Tests:", "Test Suites:"))]
        print(f"jest       {'ok' if not new else 'FAIL'} ({'; '.join(totals)}; new failures: {len(new)})")
        for test in new:
            print("    NEW", test)
        ok &= not new

    print("GATE", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
