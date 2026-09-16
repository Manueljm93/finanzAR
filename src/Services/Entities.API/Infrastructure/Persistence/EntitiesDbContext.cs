using FinanzasAR.Entities.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanzasAR.Entities.API.Infrastructure.Persistence;

public class EntitiesDbContext(DbContextOptions<EntitiesDbContext> options) : DbContext(options)
{
    public DbSet<FinancialEntity> FinancialEntities => Set<FinancialEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("entities");

        modelBuilder.Entity<FinancialEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        });
    }
}
