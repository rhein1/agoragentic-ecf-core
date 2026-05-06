# Expected Output

Running:

```bash
ecf-core compile . --agent-os
ecf-core eval .
ecf-core validate .ecf-core
```

creates:

```text
.ecf-core/
  context-packet.json
  source-map.json
  policy-summary.json
  evidence-units.json
  context-evidence-units.json
  context-compaction-report.json
  page-index.json
  tree-index.json
  retrieval-plan.json
  manifest.json
  deployment-preview.json
  agent-os-harness.json
  agent-os-handoff.json
  agent-os-import.json
  eval-report.json
  eval-report.md
```

The expected eval verdict for a clean local project is `pass`.

The generated Agent OS artifacts are preview-only. They do not deploy agents, authorize spend, route marketplace calls, or include Full ECF private internals.
