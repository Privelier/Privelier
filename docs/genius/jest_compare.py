"""Compare a jest text run against the night-shift baseline failures.

The 2026-10-28 baseline on this machine fails tests that assume an English
ICU locale and a UTC clock (the machine runs German, Europe/Berlin; CI runs
Ubuntu en-US UTC). This script proves that a later run adds no NEW failure.

usage: python docs/genius/jest_compare.py baseline JEST_OUTPUT   write the set
       python docs/genius/jest_compare.py compare JEST_OUTPUT    exit 1 on new
"""
import pathlib
import re
import sys

BASELINE = pathlib.Path(__file__).with_name("jest-baseline-failures.txt")


def failures(path: str) -> set[str]:
    text = pathlib.Path(path).read_text(encoding="utf-8", errors="replace")
    current = None
    found = set()
    for line in text.splitlines():
        match = re.match(r"^FAIL\s+(\S+)", line)
        if match:
            current = match.group(1).replace("\\", "/")
            continue
        match = re.match(r"^\s+● (.+)$", line)
        if match and current and "Console" not in match.group(1):
            found.add(f"{current} :: {match.group(1).strip()}")
    return found


def main() -> None:
    mode, path = sys.argv[1], sys.argv[2]
    got = failures(path)
    if mode == "baseline":
        BASELINE.write_text("\n".join(sorted(got)) + "\n", encoding="utf-8")
        print(f"baseline: {len(got)} failing tests")
        return
    base = set(BASELINE.read_text(encoding="utf-8").splitlines())
    new = sorted(got - base)
    print(f"failing now: {len(got)}, baseline: {len(base)}, new: {len(new)}")
    for name in new:
        print("NEW", name)
    sys.exit(1 if new else 0)


if __name__ == "__main__":
    main()
