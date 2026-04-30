# API Auth Boundary

The local agent can read endpoint summaries, request shapes, and public error behavior.

It must not read production API keys, bearer tokens, webhook secrets, or private customer payloads.

Agent OS preview can use the OpenAPI summary for routing review, but live deploy remains disabled.
