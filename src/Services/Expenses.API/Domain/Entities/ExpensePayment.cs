namespace FinanzasAR.Expenses.API.Domain.Entities;

// La existencia de un ExpensePayment para (FixedExpenseId, Year, Month) significa
// que ese gasto fijo fue pagado en ese mes. Si no existe, está pendiente.
public class ExpensePayment
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public Guid FixedExpenseId { get; private set; }
    public int Year { get; private set; }
    public int Month { get; private set; }
    public DateTime PaidAt { get; private set; } = DateTime.UtcNow;

    private ExpensePayment() { }

    public static ExpensePayment Create(Guid userId, Guid fixedExpenseId, int year, int month) =>
        new()
        {
            UserId = userId,
            FixedExpenseId = fixedExpenseId,
            Year = year,
            Month = month
        };
}
