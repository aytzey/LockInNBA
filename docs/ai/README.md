# AI Docs Index

This folder is the detailed project map for coding agents.

Why it exists:

- root `AGENTS.md` is the Codex-oriented entrypoint
- root `CLAUDE.md` stays intentionally small so Claude Code does not waste context
- the files in this folder hold the long-form explanations that would otherwise bloat root memory files

## Recommended Read Order

1. `project-map.md`
2. `backend-and-data.md`
3. `frontend-and-ux.md`
4. `operations-and-deploy.md`
5. `change-playbook.md`

## File Guide

- `claude-core.md`
  Compact import-safe summary for `CLAUDE.md`.

- `project-map.md`
  High-level architecture, directory ownership, route inventory, and state boundaries.

- `backend-and-data.md`
  Detailed persistence model, LLM behavior, live-score rules, auth, payments, and chat flow.

- `frontend-and-ux.md`
  Homepage state model, component map, unlock flows, polling behavior, and UI guardrails.

- `operations-and-deploy.md`
  Environment variables, Lambda/CloudFront deployment model, local smoke tests, and cost-sensitive ops notes.

- `change-playbook.md`
  Safe-edit guidance for common tasks, anti-patterns, and verification matrices.

## External Guidance Used To Shape This Folder

- OpenAI says Codex works better with clear repository guidance, configured environments, and `AGENTS.md` context.
- OpenAI's internal Codex guide recommends giving structure, context, and room to iterate, and using repository docs for business logic and quirks.
- Anthropic recommends keeping each `CLAUDE.md` concise, using imports for extra context, and placing path-specific memory files in subdirectories so they load on demand.

Official references:

- https://openai.com/index/introducing-codex/
- https://openai.com/index/introducing-upgrades-to-codex/
- https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf
- https://code.claude.com/docs/en/memory
- https://www.anthropic.com/engineering/claude-code-best-practices
