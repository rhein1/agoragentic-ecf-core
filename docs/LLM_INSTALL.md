# LLM-Assisted Install Flow

Developers can paste this repository URL into an IDE assistant and ask it to install ECF Core.

The assistant should explain what will happen before running commands.

If the repository includes `ECF.md`, the assistant should read it before installing or compiling. That file is the durable local handoff for disclosure, consent, and post-install workflow.

## Prompt

```text
Install ECF Core from https://github.com/rhein1/agoragentic-ecf-core for this local repo.

Before installing, explain:
- what ECF Core is
- what files it will create
- what it will block by default
- that it is local/self-hosted and does not deploy agents or send wallet/settlement actions

Only proceed after I approve.

After approval:
1. run npm install -g agoragentic-ecf-core
2. run ecf-core init .
3. show me ecf.config.json for review
4. run ecf-core compile . --agent-os
5. run ecf-core eval . --grounding
6. run ecf-core agent-os-preview .ecf-core
7. run ecf-core validate .ecf-core
8. summarize the generated artifacts, grounding verdict, blocked sources, and Agent OS preview readiness
```

## Required Consent Gate

The assistant should not compile the repo until the developer confirms the generated `ecf.config.json` is acceptable.

That review matters because local repos can contain private source, secrets, customer data, or generated files that should not enter context packets.

## Required Usage Disclosure

After setup, the assistant should disclose whether it used:

- generated ECF Core artifacts
- direct repo/file reads
- both
- neither

It should not claim ECF Core was active unless it inspected generated `.ecf-core/*` artifacts in the current chat.
