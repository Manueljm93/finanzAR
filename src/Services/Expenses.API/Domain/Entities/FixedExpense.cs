namespace FinanzasAR.Expenses.API.Domain.Entities;

public enum Currency { ARS, USD }

public enum ExpenseCategory { Impuesto, Servicio, Alquiler, Pago, Otro }

public class FixedExpense
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Description { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public Currency Currency { get; private set; }
    public ExpenseCategory Category { get; private set; }
    public int DueDay { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private FixedExpense() { }

    public static FixedExpense Create(Guid userId, string description, decimal amount,
        Currency currency, ExpenseCategory category, int dueDay) =>
        new()
        {
            UserId = userId,
            Description = description,
            Amount = amount,
            Currency = currency,
            Category = category,
            DueDay = dueDay
        };

    public void Update(string description, decimal amount, Currency currency,
        ExpenseCategory category, int dueDay)
    {
        Description = description;
        Amount = amount;
        Currency = currency;
        Category = category;
        DueDay = dueDay;
    }
}
