# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repo.

- Read `CONTEXT.md` at the repo root before non-trivial code changes.
- Read relevant ADRs under `docs/adr/` before changing architecture or gameplay rules.
- There is no `CONTEXT-MAP.md`; do not look for multiple bounded contexts unless the repo structure changes.

## Vocabulary

When output names a domain concept, issue title, refactor proposal, test name, or hypothesis, use the terms from `CONTEXT.md`. If a needed concept is missing, note the gap and update the context only when the task asks for domain modeling or documentation.

## ADR Conflicts

If a proposed change contradicts an existing ADR, call that out explicitly instead of silently overriding the recorded decision.
