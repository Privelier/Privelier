# Privelier context-token optimization report

Date: 2026-09-06. Benchmark commit baseline: `a60d69c`. Tokenizer for Repomix measurements: `o200k_base`.

## Tools evaluated and selected

### Graphify 0.9.55 — primary

[Graphify](https://github.com/Graphify-Labs/graphify) builds a persistent queryable code graph using local Tree-sitter AST extraction. Its official README documents incremental `update`, `query` budgets, freshness hooks, and a built-in benchmark. The project is Apache-2.0 licensed. Privelier pins `graphifyy[sql]==0.9.55`; the PyPI package name differs from the `graphify` executable.

Why selected: relationships and impact questions can be answered without repacking source, and code-only updates need no cloud model or API key. Limitation: Graphify's own generic benchmark averaged only 4.2× reduction on this corpus; results vary greatly by question, and code-only mode does not semantically index Markdown.

### Repomix 1.18.0 — narrow fallback and measurement

[Repomix](https://github.com/yamadashy/repomix) provides Git-aware selection, token counting, secret scanning, hard token budgets, and Tree-sitter `--compress`. It is MIT licensed. The wrapper invokes the exact `repomix@1.18.0` package with `npx`; it is not added to the mobile dependency tree and requires Node 22 or newer.

Why selected: it produces reproducible tokenizer counts and a compact implementation slice when a graph answer is insufficient. Limitation: compression did not reduce the tested four-file TypeScript auth slice in this version; its value here is safe scoping and measurement, not guaranteed compression.

### Aider repository map — researched, not installed

[Aider's repository map](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py) uses Tree-sitter tags, caching, and a configurable token budget. It is effective inside Aider, but installing a second coding client solely for its internal map would duplicate Graphify and Repomix. It is therefore not part of this workflow.

## Measured analytics

| Workflow | Measured context | Reduction against baseline | Appropriate use |
|---|---:|---:|---|
| Naive code corpus | about 90,733 tokens | 0% | Broad audit only |
| Graphify built-in average | about 21,850 tokens | 75.9% | Unbounded generic benchmark |
| Privelier bounded graph query | at most 1,200 tokens | **at least 98.7%** | First lookup for every code question |
| Scoped Repomix auth slice | 3,973 tokens | **95.6%** | Four implementation files after graph lookup |
| Root instructions after backlog split | 3,830 tokens vs 27,098 combined previously | **85.9%** | Mandatory session policy load |

The four representative bounded graph queries covered app-root/auth navigation, pending-booking creation, booking Realtime propagation, and manual-verification protection. Each completed beneath the 1,200-token graph budget. Their output sizes were 4,153–4,264 bytes (median 4,233 bytes), demonstrating stable bounded retrieval; byte size is reported separately and is not presented as a token count.

The requested 90% target is met for **code retrieval** by the normal bounded Graphify path (>=98.7%) and the measured scoped Repomix fallback (95.6%). It is not met by Graphify's generic unbounded benchmark (75.9%) or by the instruction split alone (85.9%). No honest percentage can be promised for total Codex usage because reasoning, generated code, tool output, system instructions, and host-injected chat history remain outside these repository tools.

## Daily workflow

1. Run `npm run context:check`. On a new clone run `npm run context:bootstrap`.
2. Ask the graph: `npm run context:query -- query "How does booking creation work?"`.
3. Use `path` or `explain` for a named relationship or concept.
4. If details are missing, pack only named files: `npm run context:pack -- src/customer/bookingCreateData.ts src/shared/bookingTime.ts`.
5. Read only the exact remaining source ranges.
6. After code changes run `npm run context:update` and `npm run context:check`.
7. Optionally install the chaining post-commit refresh with `tools/context/install-hook.sh`.

For a new feature, start a new chat rather than carrying the complete old conversation. Locate the relevant execution record with `rg -n "<feature>" docs/project/ACTIVE_BACKLOG.md` and read only that section.

## Costs, risks, and expected effect

- One-time local graph build indexes roughly 200 code files and creates ignored artifacts. Incremental updates are the steady-state path.
- The graph can omit semantic relationships, especially in prose. Validate important claims against exact source ranges.
- A stale graph is worse than a missing one; the wrapper hashes working-tree code and fails closed.
- Repomix runs from an exact npm version but is not integrity-locked in this repository; a fresh machine may download executable registry content. Graphify pins its top-level Python package but not transitive hashes. This is the remaining supply-chain trade-off for avoiding a large tooling-only lockfile diff.
- Packed source and graph artifacts are local and ignored. Repomix input is positive-allowlisted to tracked files, secret-like names are refused, its security scan remains enabled, and output permissions are restricted.
- The practical expectation for ordinary Privelier code navigation is **95–99% less retrieval context** versus rereading the code corpus. End-to-end session savings will be lower and depend on task complexity and host-provided history.
