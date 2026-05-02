var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { ok = true }));
app.MapGet("/orders/{id}", (string id) => Results.Ok(new { id, status = "preview" }));
app.MapPost("/orders/{id}/review", (string id) => Results.Accepted($"/orders/{id}"));

app.Run();

