"""Privelier UI audit — keeps the design system, accessibility and motion
performance honest as the app grows. Standard library only; prints findings
to the console (no report files) and can gate CI with --strict.

Rules
  color-token     hex colour outside the brand palette / theme files
  all-caps        textTransform 'uppercase' (brand: sentence case, never caps)
  font-token      hard-coded fontFamily string instead of theme fonts
  a11y-role       Pressable without accessibilityRole (screen readers say nothing useful)
  native-driver   RN Animated.timing/spring/decay without useNativeDriver (JS-thread jank)
  rn-image        Image from 'react-native' (no disk cache, no fade) — use expo-image
  list-key        FlatList/SectionList without keyExtractor
  list-window     FlatList without render-window tuning (listPerformance)

Usage
  python3 tools/ui/ui_audit.py              # summary + findings
  python3 tools/ui/ui_audit.py --rule rn-image
  python3 tools/ui/ui_audit.py --strict     # exit 1 on any error-level finding
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"

# Files allowed to define raw colours: the token sources and the map/chart
# renderers that hand colours to native/SVG/HTML layers.
COLOR_ALLOW = ("theme/", "shared/maps/", "shared/components/GlassSurface", "shared/components/Avatar")
SEVERITY = {
    "color-token": "warn",
    "all-caps": "error",
    "font-token": "warn",
    "a11y-role": "error",
    "native-driver": "error",
    "rn-image": "warn",
    "list-key": "error",
    "list-window": "info",
}


@dataclass
class Finding:
    rule: str
    path: Path
    line: int
    detail: str


def palette() -> set[str]:
    text = (SRC / "theme" / "colors.ts").read_text(encoding="utf-8")
    return {c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}\b", text)}


def window(lines: list[str], i: int, size: int = 14) -> str:
    return "\n".join(lines[i:i + size])


def audit_file(path: Path, brand: set[str]) -> list[Finding]:
    rel = path.relative_to(SRC).as_posix()
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    out: list[Finding] = []

    if not rel.startswith(COLOR_ALLOW):
        for i, line in enumerate(lines):
            if line.lstrip().startswith(("//", "*")):
                continue
            for color in re.findall(r"['\"](#[0-9A-Fa-f]{6})['\"]", line):
                if color.upper() not in brand:
                    out.append(Finding("color-token", path, i + 1, f"{color} is not a palette colour"))

    for i, line in enumerate(lines):
        if re.search(r"textTransform:\s*['\"]uppercase['\"]", line):
            out.append(Finding("all-caps", path, i + 1, "uppercase text"))
        if re.search(r"fontFamily:\s*['\"][A-Za-z]", line):
            out.append(Finding("font-token", path, i + 1, "literal fontFamily"))

    for i, line in enumerate(lines):
        # JSX only (a line that opens the element), not generics like useRef<FlatList<…>>.
        if re.match(r"\s*(\(\s*)?<(Pressable|PressableScale)\b", line):
            if "{..." in "\n".join(lines[i:i + 3]):
                continue  # wrapper forwarding props: the role comes from its caller
            block = window(lines, i)
            end = block.find(">\n") if ">\n" in block else len(block)
            if "accessibilityRole" not in block[: max(end, 0) + 400]:
                out.append(Finding("a11y-role", path, i + 1, "pressable without accessibilityRole"))

    for i, line in enumerate(lines):
        if re.search(r"\bAnimated\.(timing|spring|decay)\(", line) and "react-native-reanimated" not in text[:2000]:
            if "useNativeDriver" not in window(lines, i, 8):
                out.append(Finding("native-driver", path, i + 1, "missing useNativeDriver"))

    rn_import = re.search(r"import \{([^}]*)\} from 'react-native';", text)
    if rn_import and re.search(r"\bImage\b", rn_import.group(1)):
        out.append(Finding("rn-image", path, text[: rn_import.start()].count("\n") + 1, "Image from react-native"))

    for i, line in enumerate(lines):
        if re.match(r"\s*(\(\s*)?<(FlatList|SectionList)\b", line):
            block = window(lines, i, 30)
            if "keyExtractor" not in block:
                out.append(Finding("list-key", path, i + 1, "no keyExtractor"))
            if "FlatList" in line and "listPerformance" not in block and "horizontal" not in block and "scrollEnabled={false}" not in block:
                out.append(Finding("list-window", path, i + 1, "no listPerformance spread"))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rule", help="only show one rule")
    parser.add_argument("--strict", action="store_true", help="exit 1 on error-level findings")
    args = parser.parse_args()

    brand = palette()
    files = [p for p in SRC.rglob("*.tsx") if "__tests__" not in p.parts]
    findings = [f for p in sorted(files) for f in audit_file(p, brand)]
    if args.rule:
        findings = [f for f in findings if f.rule == args.rule]

    by_rule = Counter(f.rule for f in findings)
    print(f"UI audit · {len(files)} files · {len(findings)} findings")
    for rule, count in sorted(by_rule.items(), key=lambda kv: (SEVERITY[kv[0]] != "error", kv[0])):
        print(f"  {SEVERITY[rule]:<5} {rule:<14} {count}")

    grouped: dict[str, list[Finding]] = defaultdict(list)
    for f in findings:
        grouped[f.rule].append(f)
    for rule, items in grouped.items():
        print(f"\n{rule}")
        for f in items[:25]:
            print(f"  {f.path.relative_to(ROOT).as_posix()}:{f.line}  {f.detail}")
        if len(items) > 25:
            print(f"  … {len(items) - 25} more (use --rule {rule})")

    errors = sum(1 for f in findings if SEVERITY[f.rule] == "error")
    return 1 if args.strict and errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
