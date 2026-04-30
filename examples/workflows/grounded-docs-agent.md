# Grounded Docs Agent Readiness

Goal: check whether a docs or support agent can answer from allowed project sources without hallucinating.

## Use This When

- a docs agent will answer product, API, policy, or support questions
- unsupported answers should fail closed
- you want to find missing docs before deployment

## Example Config Slice

Add grounding questions to `ecf.config.json`:

```json
{
  "eval": {
    "queries": ["authentication setup", "refund policy"],
    "grounding_queries": [
      "How does authentication work?",
      "What is the refund policy?",
      "Can the agent email customers automatically?"
    ],
    "top_k": 3,
    "max_retries": 1,
    "rewrite_enabled": true,
    "grounding_required": true,
    "unsupported_response": "I don't know based on the allowed context."
  }
}
```

## Run

```bash
ecf-core compile . --agent-os
ecf-core eval . --grounding
```

## Review

Open:

```text
.ecf-core/grounding-eval.md
.ecf-core/grounding-eval.json
```

Grounded questions should include citations. Unsupported questions should return the configured unsupported response.

## Pass Criteria

- Supported questions have citations from allowed sources.
- Unsupported questions are marked `unsupported` or `blocked`.
- Blocked source questions do not retrieve blocked files.
- Context gaps produce suggested fixes instead of invented answers.
