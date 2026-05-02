using EfCoreApp.Models;
using Microsoft.EntityFrameworkCore;

namespace EfCoreApp.Data;

public sealed class AppDbContext : DbContext
{
    public DbSet<Order> Orders => Set<Order>();
}

