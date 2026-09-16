namespace FinanzasAR.Entities.API.Domain.Entities;

public enum EntityType { Bank, DigitalWallet, Other }

public class FinancialEntity
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Name { get; private set; } = null!;
    public EntityType Type { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private FinancialEntity() { }

    public static FinancialEntity Create(Guid userId, string name, EntityType type) =>
        new() { UserId = userId, Name = name, Type = type };

    public void Update(string name, EntityType type, bool isActive)
    {
        Name = name;
        Type = type;
        IsActive = isActive;
    }
}
