namespace FinanzasAR.Vencimientos.API.Domain.Entities;

public enum Moneda { ARS, USD }

public enum Confianza { Alta, Media, Baja }

public enum OrigenProceso { BodyMail, AdjuntoPdf, AdjuntoImagen }

public class Vencimiento
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }

    // Origen
    public string GmailMessageId { get; private set; } = null!;
    public string RemitenteEmail { get; private set; } = null!;
    public string Empresa { get; private set; } = null!;
    public string? Asunto { get; private set; }
    public DateTime FechaMail { get; private set; }

    // Datos extraídos
    public decimal? MontoTotal { get; private set; }
    public Moneda Moneda { get; private set; } = Moneda.ARS;
    public DateOnly? FechaVencimiento { get; private set; }
    public DateOnly? FechaVencimiento2 { get; private set; }
    public string? Periodo { get; private set; }
    public Confianza Confianza { get; private set; } = Confianza.Baja;

    // Control
    public OrigenProceso ProcesadoCon { get; private set; }
    public bool ProcesadoOk { get; private set; }
    public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

    private Vencimiento() { }

    public static Vencimiento Create(
        Guid userId, string gmailMessageId, string remitenteEmail, string empresa,
        string? asunto, DateTime fechaMail, OrigenProceso origen,
        decimal? montoTotal, Moneda moneda, DateOnly? vencimiento, DateOnly? vencimiento2,
        string? periodo, Confianza confianza, bool procesadoOk) =>
        new()
        {
            UserId = userId,
            GmailMessageId = gmailMessageId,
            RemitenteEmail = remitenteEmail,
            Empresa = empresa,
            Asunto = asunto,
            FechaMail = fechaMail,
            ProcesadoCon = origen,
            MontoTotal = montoTotal,
            Moneda = moneda,
            FechaVencimiento = vencimiento,
            FechaVencimiento2 = vencimiento2,
            Periodo = periodo,
            Confianza = confianza,
            ProcesadoOk = procesadoOk
        };
}
