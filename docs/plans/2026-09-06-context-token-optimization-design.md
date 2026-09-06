# Context token optimization design

## Scope

This is one developer-tooling feature. It does not change the Expo apps, Supabase schema, product behavior, or release scope. The goal is to reduce repeated repository ingestion while keeping context fresh and verifiable. A 90% reduction is a measurement target, not a promise about billing or total sessions.

## Retrieval architecture

The read path is Graphify-first. A local, code-only AST graph is bootstrapped on a fresh clone, checked against a digest of tracked and untracked non-ignored code before use, and queried with a 1,200-token budget. Missing and stale graphs fail closed. `graphify update .` refreshes changed code without an LLM or API key.

When a graph answer lacks implementation detail, Repomix is a fallback for an explicit list of tracked files. Whole-repository packing is intentionally unavailable. Tree-sitter compression, the secret scan, a mode-0600 ignored output, and an 8,000-token budget bound its exposure and cost. Exact source ranges are read last.

The root instruction file retains the stable authoritative product, security, schema, and pipeline rules. The long living backlog moves verbatim to an authoritative dedicated document and is located with `rg` before reading only the relevant section. This avoids loading unrelated historical progress on every task.

## Freshness and failure behavior

The graph state hashes graph configuration, the pinned Graphify requirement, file paths, and contents. Working-tree edits and new non-ignored code therefore make `context:check` fail. `context:update` bootstraps automatically when output is absent. An opt-in post-commit hook is convenience only; it chains existing hook content and does not replace Git hook configuration.

The repository cannot stop Codex Desktop or another host from injecting system prompts and prior chat messages. New features should start in fresh conversations, using the graph and relevant backlog section as the handoff.

## Validation and security

Validation covers fresh bootstrap, freshness, stale working-tree detection, bounded queries, empty/broad/untracked/secret path rejection, scoped packing, file permissions, dependency audits, application lint/type/tests, and secret scans. Generated graphs and packed source stay ignored; only aggregate benchmark evidence is committed.
