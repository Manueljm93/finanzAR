namespace FinanzasAR.Identity.API.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Token { get; private set; } = null!;
    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }

    private RefreshToken() { }

    public static RefreshToken Create(Guid userId, string token, int daysValid = 30) =>
        new() { UserId = userId, Token = token, ExpiresAt = DateTime.UtcNow.AddDays(daysValid) };

    public bool IsExpired => DateTime.UtcNow > ExpiresAt;

    public void Revoke() => IsRevoked = true;
}
