namespace FinanzasAR.Vencimientos.API.Domain.Entities;

// Una conexión Gmail por usuario. Guarda el refresh_token ENCRIPTADO (AES-256).
public class GmailConnection
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Email { get; private set; } = null!;
    public string RefreshTokenCifrado { get; private set; } = null!;
    public DateTime ConectadoEn { get; private set; } = DateTime.UtcNow;
    public DateTime? UltimaSync { get; private set; }

    private GmailConnection() { }

    public static GmailConnection Create(Guid userId, string email, string refreshTokenCifrado) =>
        new()
        {
            UserId = userId,
            Email = email,
            RefreshTokenCifrado = refreshTokenCifrado
        };

    public void Actualizar(string email, string refreshTokenCifrado)
    {
        Email = email;
        RefreshTokenCifrado = refreshTokenCifrado;
        ConectadoEn = DateTime.UtcNow;
    }

    public void MarcarSync() => UltimaSync = DateTime.UtcNow;
}
