namespace FinanzasAR.Monotributo.API.Domain.Entities;

public class MonthlyGoal
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public decimal Amount { get; private set; }
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    private MonthlyGoal() { }

    public static MonthlyGoal Create(Guid userId, decimal amount) =>
        new() { UserId = userId, Amount = amount };

    public void SetAmount(decimal amount)
    {
        Amount = amount;
        UpdatedAt = DateTime.UtcNow;
    }
}
