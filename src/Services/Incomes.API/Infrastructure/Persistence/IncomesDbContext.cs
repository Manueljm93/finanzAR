using FinanzasAR.Incomes.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanzasAR.Incomes.API.Infrastructure.Persistence;

public class IncomesDbContext(DbContextOptions<IncomesDbContext> options) : DbContext(options)
{
    public DbSet<Income> Incomes => Set<Income>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("incomes");

        modelBuilder.Entity<Income>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.Description).HasMaxLength(500);
        });
    }
}
