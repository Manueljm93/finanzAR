using System.Text;
using System.Text.RegularExpressions;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;

namespace FinanzasAR.Vencimientos.API.Infrastructure.Gmail;

public record MailContenido(
    string MessageId, string From, string FromEmail, string? Subject, DateTime Date, string Body);

// Escanea Gmail filtrando por remitentes y extrae el texto del cuerpo (Fase 1: sin adjuntos).
public class GmailScanner
{
    public async Task<string> ObtenerEmailCuentaAsync(GmailService gmail, CancellationToken ct)
    {
        var profile = await gmail.Users.GetProfile("me").ExecuteAsync(ct);
        return profile.EmailAddress;
    }

    public async Task<IReadOnlyList<MailContenido>> EscanearAsync(
        GmailService gmail, IEnumerable<(string Email, DateTime? Desde)> remitentes, CancellationToken ct)
    {
        // Cada remitente lleva su propia ventana: desde su último procesado, o los últimos 90 días si es nuevo.
        var grupos = remitentes.Select(r =>
        {
            var fecha = r.Desde.HasValue
                ? $"after:{new DateTimeOffset(DateTime.SpecifyKind(r.Desde.Value, DateTimeKind.Utc)).ToUnixTimeSeconds()}"
                : "newer_than:90d";
            return $"(from:{r.Email} {fecha})";
        }).ToList();
        if (grupos.Count == 0) return Array.Empty<MailContenido>();

        var query = string.Join(" OR ", grupos);

        var listReq = gmail.Users.Messages.List("me");
        listReq.Q = query;
        listReq.MaxResults = 50;
        var list = await listReq.ExecuteAsync(ct);

        var result = new List<MailContenido>();
        if (list.Messages is null) return result;

        foreach (var m in list.Messages)
        {
            var getReq = gmail.Users.Messages.Get("me", m.Id);
            getReq.Format = UsersResource.MessagesResource.GetRequest.FormatEnum.Full;
            var msg = await getReq.ExecuteAsync(ct);

            var payload = msg.Payload;
            var headers = payload?.Headers ?? new List<MessagePartHeader>();
            string? H(string name) =>
                headers.FirstOrDefault(h => string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase))?.Value;

            var from = H("From") ?? "";
            var subject = H("Subject");
            var date = DateTime.TryParse(H("Date"), out var d) ? d.ToUniversalTime() : DateTime.UtcNow;
            var body = payload is null ? "" : ExtraerBody(payload);

            result.Add(new MailContenido(m.Id, from, ExtraerEmail(from), subject, date, body));
        }
        return result;
    }

    private static string ExtraerBody(MessagePart payload)
    {
        // Algunos mails traen un text/plain inútil ("su cliente no soporta HTML, abra esta URL")
        // y el contenido real en el HTML. Nos quedamos con la parte que tenga más texto.
        var plain = BuscarParte(payload, "text/plain") ?? "";
        var html = BuscarParte(payload, "text/html");
        var htmlText = string.IsNullOrWhiteSpace(html) ? "" : StripHtml(html!);
        return htmlText.Length > plain.Length ? htmlText : plain;
    }

    private static string? BuscarParte(MessagePart part, string mime)
    {
        if (string.Equals(part.MimeType, mime, StringComparison.OrdinalIgnoreCase) && part.Body?.Data != null)
            return DecodeB64Url(part.Body.Data);
        if (part.Parts != null)
            foreach (var p in part.Parts)
            {
                var r = BuscarParte(p, mime);
                if (!string.IsNullOrWhiteSpace(r)) return r;
            }
        return null;
    }

    private static string DecodeB64Url(string data)
    {
        var s = data.Replace('-', '+').Replace('_', '/');
        s = (s.Length % 4) switch { 2 => s + "==", 3 => s + "=", _ => s };
        return Encoding.UTF8.GetString(Convert.FromBase64String(s));
    }

    private static string StripHtml(string html) =>
        Regex.Replace(Regex.Replace(html, "<[^>]+>", " "), @"\s+", " ").Trim();

    private static string ExtraerEmail(string from)
    {
        var m = Regex.Match(from, "<(.+?)>");
        return (m.Success ? m.Groups[1].Value : from).Trim().ToLowerInvariant();
    }
}
