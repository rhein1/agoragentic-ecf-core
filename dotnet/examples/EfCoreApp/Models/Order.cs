namespace EfCoreApp.Models;

public sealed record Order(Guid Id, string Status, DateTimeOffset CreatedAt);

