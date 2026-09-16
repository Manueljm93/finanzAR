namespace FinanzasAR.Monotributo.API.Domain.Entities;

public class Category
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Letter { get; private set; } = null!;
    public decimal MaxAnnualIncome { get; private set; }
    public decimal IntegratedTax { get; private set; }
    public decimal SIPAContribution { get; private set; }
    public decimal SocialSecurity { get; private set; }
    public decimal TotalMonthly { get; private set; }
    public DateOnly ValidFrom { get; private set; }
    public DateOnly? ValidTo { get; private set; }

    private Category() { }

    public static Category Create(string letter, decimal maxAnnualIncome,
        decimal integratedTax, decimal sipa, decimal socialSecurity, DateOnly validFrom) =>
        new()
        {
            Letter = letter,
            MaxAnnualIncome = maxAnnualIncome,
            IntegratedTax = integratedTax,
            SIPAContribution = sipa,
            SocialSecurity = socialSecurity,
            TotalMonthly = integratedTax + sipa + socialSecurity,
            ValidFrom = validFrom
        };

    public bool IsActive(DateOnly date) =>
        date >= ValidFrom && (ValidTo == null || date <= ValidTo);
}
