using FinanzasAR.Expenses.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanzasAR.Expenses.API.Infrastructure.Persistence;

public class ExpensesDbContext(DbContextOptions<ExpensesDbContext> options) : DbContext(options)
{
    public DbSet<FixedExpense> FixedExpenses => Set<FixedExpense>();
    public DbSet<ExpensePayment> ExpensePayments => Set<ExpensePayment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("expenses");

        modelBuilder.Entity<FixedExpense>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<ExpensePayment>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.FixedExpenseId, x.Year, x.Month }).IsUnique();
        });
    }
}
