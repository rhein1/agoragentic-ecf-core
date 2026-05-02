# EF Core Example

This example lets `ecfnet compile --agent-os` detect EF Core schema hints while treating production configuration as review-required.

Expected ECF behavior:

- `AppDbContext` and `DbSet<Order>` are summarized as EF Core evidence.
- `appsettings.Production.json` is marked review-required.
- Connection strings and instrumentation keys are redacted before export.

