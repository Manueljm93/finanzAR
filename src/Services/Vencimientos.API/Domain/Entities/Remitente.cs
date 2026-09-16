namespace FinanzasAR.Vencimientos.API.Domain.Entities;

public class Remitente
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string Email { get; private set; } = null!;
    public string Empresa { get; private set; } = null!;
    public bool Activo { get; private set; } = true;
    public DateTime? UltimoProcesado { get; private set; }
    public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

    private Remitente() { }

    public static Remitente Create(Guid userId, string email, string empresa, bool activo = true) =>
        new()
        {
            UserId = userId,
            Email = email.Trim().ToLowerInvariant(),
            Empresa = empresa.Trim(),
            Activo = activo
        };

    public void Update(string email, string empresa, bool activo)
    {
        Email = email.Trim().ToLowerInvariant();
        Empresa = empresa.Trim();
        Activo = activo;
    }

    public void MarcarProcesado() => UltimoProcesado = DateTime.UtcNow;
}
