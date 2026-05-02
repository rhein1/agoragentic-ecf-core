# ASP.NET Minimal API Example

This example lets `ecfnet compile --agent-os` detect Minimal API routes and redact sensitive `appsettings.json` keys.

Expected ECF behavior:

- `/health`, `/orders/{id}`, and `/orders/{id}/review` are summarized as route evidence.
- `ConnectionStrings` and `OpenAI.ApiKey` are redacted before export.
- Generated Agent OS artifacts remain preview-only.

