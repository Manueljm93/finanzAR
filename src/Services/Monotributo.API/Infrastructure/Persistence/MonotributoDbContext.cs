using FinanzasAR.Monotributo.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanzasAR.Monotributo.API.Infrastructure.Persistence;

public class MonotributoDbContext(DbContextOptions<MonotributoDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<MonthlyGoal> MonthlyGoals => Set<MonthlyGoal>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("monotributo");

        modelBuilder.Entity<Category>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Letter).HasMaxLength(2);
            e.Property(x => x.MaxAnnualIncome).HasPrecision(18, 2);
            e.Property(x => x.IntegratedTax).HasPrecision(18, 2);
            e.Property(x => x.SIPAContribution).HasPrecision(18, 2);
            e.Property(x => x.SocialSecurity).HasPrecision(18, 2);
            e.Property(x => x.TotalMonthly).HasPrecision(18, 2);
        });

        modelBuilder.Entity<MonthlyGoal>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.UserId).IsUnique();
            e.Property(x => x.Amount).HasPrecision(18, 2);
        });
    }
}
