namespace FinanzasAR.Incomes.API.Domain.Entities;

public enum Currency { ARS, USD }

public class Income
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public decimal Amount { get; private set; }
    public Currency Currency { get; private set; }
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = null!;
    public Guid? EntityId { get; private set; }
    public int Month { get; private set; }
    public int Year { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private Income() { }

    public static Income Create(Guid userId, decimal amount, Currency currency,
        DateOnly date, string description, Guid? entityId) =>
        new()
        {
            UserId = userId,
            Amount = amount,
            Currency = currency,
            Date = date,
            Description = description,
            EntityId = entityId,
            Month = date.Month,
            Year = date.Year
        };

    public void Update(decimal amount, Currency currency, DateOnly date,
        string description, Guid? entityId)
    {
        Amount = amount;
        Currency = currency;
        Date = date;
        Description = description;
        EntityId = entityId;
        Month = date.Month;
        Year = date.Year;
    }
}
