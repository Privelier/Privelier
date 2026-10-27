"""Check that every 64-bit native library the Android app ships is 16 KB aligned.

Google Play requires 16 KB page-size support for apps targeting Android 15+.
A full Gradle build is the usual way to check (bundletool / zipalign), but it
needs a lot of memory. This tool checks the same thing at the source: it reads
the pinned versions from node_modules, downloads the prebuilt native Maven
artifacts (React Native, Hermes, MapLibre, Fresco, fbjni, AVIF, zstd) and
verifies every arm64-v8a / x86_64 .so has PT_LOAD alignment >= 16 KB.

Modules compiled from source (expo-modules-core, reanimated, worklets,
screens, gesture-handler) are covered by the React Native Gradle plugin,
which builds every CMake module with ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON;
this tool confirms that flag is still present.

It can also check a built APK, AAB or AAR directly: pass its path.

Usage:
  py tools/android/check_16kb.py                 # pinned Maven artifacts
  py tools/android/check_16kb.py app-release.aab # a real build output

Exit code 0 when everything is aligned, 1 otherwise. When upgrading Expo or
React Native, rerun it; add any new native Maven dependency to ARTIFACTS.
"""

from __future__ import annotations

import io
import json
import re
import struct
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODE_MODULES = ROOT / "node_modules"
MAVEN = "https://repo1.maven.org/maven2"
MIN_ALIGN = 0x4000


def _fetch(url: str) -> bytes:
    # Maven Central refuses urllib's default User-Agent.
    request = urllib.request.Request(url, headers={"User-Agent": "privelier-check-16kb"})
    return urllib.request.urlopen(request, timeout=300).read()


def _read(path: str) -> str:
    return (NODE_MODULES / path).read_text(encoding="utf-8")


def _prop(path: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}\s*=\s*\"?([^\"\s]+)", _read(path), re.M)
    if not match:
        raise SystemExit(f"Could not find {key} in node_modules/{path}")
    return match.group(1)


def _pom_dependency_version(pom_url: str, artifact: str) -> str:
    pom = _fetch(pom_url).decode()
    match = re.search(rf"<artifactId>{re.escape(artifact)}</artifactId>\s*<version>([^<]+)", pom)
    if not match:
        raise SystemExit(f"{artifact} not found in {pom_url}")
    return match.group(1)


def pinned_artifacts() -> list[tuple[str, str, str, str]]:
    """(group, artifact, version, classifier suffix) for every prebuilt native dependency."""
    rn = json.loads(_read("react-native/package.json"))["version"]
    hermes = _prop("react-native/sdks/hermes-engine/version.properties", "HERMES_VERSION_NAME")
    fresco = _prop("react-native/gradle/libs.versions.toml", "fresco")
    maplibre_props = "@maplibre/maplibre-react-native/android/gradle.properties"
    maplibre = _prop(maplibre_props, "org.maplibre.reactnative.nativeVersion")
    variant = _prop(maplibre_props, "org.maplibre.reactnative.nativeVariant")
    glide = re.search(r'GLIDE_VERSION\s*=\s*"([^"]+)"', _read("expo-image/android/build.gradle")).group(1)
    avif = _pom_dependency_version(
        f"{MAVEN}/com/github/bumptech/glide/avif-integration/{glide}/avif-integration-{glide}.pom", "avif"
    )
    module = json.loads(_fetch(f"{MAVEN}/com/facebook/react/react-android/{rn}/react-android-{rn}.module"))
    deps = {d["module"]: d["version"]["requires"] for v in module["variants"] for d in v.get("dependencies", [])}
    return [
        ("com/facebook/react", "react-android", rn, "-release"),
        ("com/facebook/hermes", "hermes-android", hermes, "-release"),
        ("com/facebook/fbjni", "fbjni", deps["fbjni"], ""),
        ("com/facebook/soloader", "soloader", deps["soloader"], ""),
        ("com/facebook/fresco", "imagepipeline-native", fresco, ""),
        ("com/facebook/fresco", "nativeimagefilters", fresco, ""),
        ("com/facebook/fresco", "nativeimagetranscoder", fresco, ""),
        ("org/maplibre/gl", f"android-sdk-{variant}", maplibre, ""),
        ("org/aomedia/avif/android", "avif", avif, ""),
        ("com/squareup/zstd", "zstd-kmp-android", "0.4.0", ""),
    ]


def min_load_alignment(data: bytes) -> int | None:
    """Smallest PT_LOAD p_align of a 64-bit ELF, or None if it is not one."""
    if data[:4] != b"\x7fELF" or data[4] != 2:
        return None
    end = "<" if data[5] == 1 else ">"
    (phoff,) = struct.unpack_from(end + "Q", data, 0x20)
    phentsize, phnum = struct.unpack_from(end + "HH", data, 0x36)
    aligns = []
    for i in range(phnum):
        offset = phoff + i * phentsize
        (ptype,) = struct.unpack_from(end + "I", data, offset)
        if ptype == 1:  # PT_LOAD
            aligns.append(struct.unpack_from(end + "Q", data, offset + 48)[0])
    return min(aligns) if aligns else None


def check_archive(name: str, blob: bytes, results: dict[str, int | None]) -> None:
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        for entry in archive.namelist():
            if entry.endswith(".so") and ("arm64-v8a" in entry or "x86_64" in entry):
                results[f"{name}!{entry}"] = min_load_alignment(archive.read(entry))
            elif entry.endswith((".apk", ".aar")):
                check_archive(f"{name}!{entry}", archive.read(entry), results)


def flexible_page_sizes_flag_present() -> bool:
    plugin = NODE_MODULES / "@react-native/gradle-plugin"
    return any(
        "ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES" in p.read_text(encoding="utf-8", errors="ignore")
        for p in plugin.rglob("NdkConfiguratorUtils.kt")
    )


def main(argv: list[str]) -> int:
    results: dict[str, int | None] = {}
    if argv:
        for arg in argv:
            check_archive(Path(arg).name, Path(arg).read_bytes(), results)
    else:
        for group, artifact, version, suffix in pinned_artifacts():
            url = f"{MAVEN}/{group}/{artifact}/{version}/{artifact}-{version}{suffix}.aar"
            print(f"checking {artifact} {version}")
            check_archive(f"{artifact}-{version}", _fetch(url), results)
        if not flexible_page_sizes_flag_present():
            print("FAIL: the React Native Gradle plugin no longer sets ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES")
            return 1

    bad = {k: v for k, v in results.items() if v is None or v < MIN_ALIGN}
    print(f"{len(results)} 64-bit native libraries checked, {len(bad)} below 16 KB")
    for name, align in sorted(bad.items()):
        print(f"  {hex(align) if align else 'not ELF'}  {name}")
    return 1 if bad or not results else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
