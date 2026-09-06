#!/usr/bin/env python3
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
GRAPH = ROOT / "graphify-out/graph.json"
STATE = ROOT / "graphify-out/source-state.json"
CODE_SUFFIXES = {".c", ".cpp", ".cs", ".go", ".java", ".js", ".jsx", ".kt", ".php", ".py", ".rb", ".rs", ".scala", ".sql", ".swift", ".ts", ".tsx"}
SECRET_NAMES = {".env", ".env.local", ".env.development", ".env.production"}


def run(command, *, input_text=None):
    return subprocess.run(command, cwd=ROOT, check=True, text=True, input=input_text)


def graphify_command():
    try:
        version = importlib.metadata.version("graphifyy")
    except importlib.metadata.PackageNotFoundError:
        version = None
    if version != "0.9.55":
        raise SystemExit("graphify 0.9.55 is required; run: python3 -m pip install --user -r tools/requirements-context.txt")
    command = shutil.which("graphify")
    if command:
        return command
    local = Path.home() / ".local/bin/graphify"
    if local.exists():
        return str(local)
    raise SystemExit("graphify is missing; run: python3 -m pip install --user -r tools/requirements-context.txt")


def tracked_code_files():
    result = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT, check=True, capture_output=True)
    paths = result.stdout.decode().split("\0")
    return sorted(path for path in paths if path and Path(path).suffix.lower() in CODE_SUFFIXES)


def source_digest():
    digest = hashlib.sha256()
    for config in (".graphifyignore", "tools/requirements-context.txt"):
        path = ROOT / config
        if path.exists():
            digest.update(config.encode())
            digest.update(path.read_bytes())
    for relative in tracked_code_files():
        digest.update(relative.encode())
        digest.update((ROOT / relative).read_bytes())
    return digest.hexdigest()


def write_state():
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({"sha256": source_digest(), "files": len(tracked_code_files())}, indent=2) + "\n")


def bootstrap(_args):
    run([graphify_command(), "extract", ".", "--code-only", "--no-cluster"])
    write_state()


def update(_args):
    if GRAPH.exists():
        run([graphify_command(), "update", "."])
    else:
        bootstrap(_args)
        return
    write_state()


def check(_args):
    if not GRAPH.exists() or not STATE.exists():
        raise SystemExit("context graph is missing; run: npm run context:bootstrap")
    state = json.loads(STATE.read_text())
    if state.get("sha256") != source_digest():
        raise SystemExit("context graph is stale; run: npm run context:update")
    print(f"context graph is fresh ({state['files']} tracked code files)")


def enforce_budget(value, maximum):
    if not 1 <= value <= maximum:
        raise SystemExit(f"budget must be between 1 and {maximum} tokens")


def query(args):
    enforce_budget(args.budget, 1200)
    check(args)
    run([graphify_command(), args.kind, *args.terms, "--budget", str(args.budget)] if args.kind == "query" else [graphify_command(), args.kind, *args.terms])


def safe_paths(paths):
    if not paths:
        raise SystemExit("provide one or more explicit tracked files; whole-repository packing is disabled")
    tracked = set(subprocess.run(["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True).stdout.splitlines())
    safe = []
    for value in paths:
        relative = str(Path(value))
        name = Path(relative).name
        if relative not in tracked:
            raise SystemExit(f"not a tracked file: {relative}")
        candidate = ROOT / relative
        if candidate.is_symlink() or not candidate.resolve().is_relative_to(ROOT):
            raise SystemExit(f"symlink or outside-root path refused: {relative}")
        if name in SECRET_NAMES or name.startswith(".env.") or Path(relative).suffix.lower() in {".key", ".pem", ".p8", ".p12", ".jks"}:
            raise SystemExit(f"secret-bearing path refused: {relative}")
        safe.append(relative)
    return safe


def pack(args):
    enforce_budget(args.budget, 8000)
    paths = safe_paths(args.paths)
    output = ROOT / "artifacts/context/repomix-output.md"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    os.umask(0o077)
    run(["npx", "--yes", "repomix@1.18.0", "--stdin", "--compress", "--style", "markdown", "--output", str(output), "--token-budget", str(args.budget)], input_text="\n".join(paths) + "\n")
    output.chmod(0o600)
    print(output.relative_to(ROOT))


def parser():
    command = argparse.ArgumentParser(description="Token-efficient repository context workflow")
    subcommands = command.add_subparsers(required=True)
    for name, handler in (("bootstrap", bootstrap), ("update", update), ("check", check)):
        subcommands.add_parser(name).set_defaults(handler=handler)
    query_parser = subcommands.add_parser("query")
    query_parser.add_argument("kind", choices=("query", "path", "explain"))
    query_parser.add_argument("terms", nargs="+")
    query_parser.add_argument("--budget", type=int, default=1200)
    query_parser.set_defaults(handler=query)
    pack_parser = subcommands.add_parser("pack")
    pack_parser.add_argument("paths", nargs="+")
    pack_parser.add_argument("--budget", type=int, default=8000)
    pack_parser.set_defaults(handler=pack)
    return command


if __name__ == "__main__":
    args = parser().parse_args()
    args.handler(args)
