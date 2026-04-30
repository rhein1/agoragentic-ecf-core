# IDE Coding Agent Context Check

Goal: give an IDE assistant a bounded local context map before it works across a repo.

## Use This When

- a coding task spans multiple files
- the assistant needs to know which sources are allowed or blocked
- a new chat needs a durable context handoff
- you want the assistant to disclose whether it used ECF Core artifacts or direct file reads

## Setup

Paste this into the IDE assistant:

```text
Use ECF Core for this repository.

First read ECF.md. Explain what ECF Core will do, what files it creates, and what it blocks by default.

Do not install or compile until I approve.

After I approve, run init, show me ecf.config.json, then compile, eval with grounding, run agent-os-preview, and validate. When answering later, state whether you used ECF Core artifacts, direct repo reads, both, or neither.
```

## Run After Approval

```bash
ecf-core init .
# Review ecf.config.json.
ecf-core compile . --agent-os
ecf-core eval . --grounding
ecf-core agent-os-preview .ecf-core
ecf-core validate .ecf-core
```

## What The Assistant Should Use

- `ECF.md` for local operating rules
- `.ecf-core/source-map.json` for source paths and citations
- `.ecf-core/policy-summary.json` for allowed/blocked boundaries
- `.ecf-core/context-packet.json` for citation-ready context
- `.ecf-core/grounding-eval.md` for unsupported questions and context gaps

## Disclosure Template

```text
Context source used:
- ECF Core artifacts: yes/no
- Direct repo reads: yes/no
- Generated files inspected: list files
- Unsupported context gaps: summarize if relevant
```
