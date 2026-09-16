using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanzasAR.Vencimientos.API.Infrastructure.Extraction;

public record ExtraccionResultado(
    [property: JsonPropertyName("monto_total")] decimal? MontoTotal,
    [property: JsonPropertyName("moneda")] string? Moneda,
    [property: JsonPropertyName("fecha_vencimiento")] string? FechaVencimiento,
    [property: JsonPropertyName("fecha_vencimiento_2")] string? FechaVencimiento2,
    [property: JsonPropertyName("periodo")] string? Periodo,
    [property: JsonPropertyName("empresa")] string? Empresa,
    [property: JsonPropertyName("confianza")] string? Confianza);

// Extrae monto + vencimiento de un mail usando Gemini (tier gratis) con structured output.
// Usa la API de Google AI Studio (generativelanguage) con una API key simple — sin GCP billing.
public class GeminiExtractor
{
    private readonly HttpClient _http;
    private readonly string? _apiKey;
    private readonly string _model;

    public bool Configurado => !string.IsNullOrWhiteSpace(_apiKey);

    private const string Prompt =
        "Analizá este correo de una factura/resumen y extraé ÚNICAMENTE los datos pedidos. " +
        "Reglas: si no encontrás un dato, poné null (no inventes). " +
        "monto_total = importe TOTAL a pagar (no subtotales). " +
        "Si hay 1er y 2do vencimiento, fecha_vencimiento es el primero y fecha_vencimiento_2 el segundo. " +
        "Fechas en formato ISO YYYY-MM-DD. " +
        "confianza: 'alta' si los datos están claros, 'media' si hay alguna ambigüedad, 'baja' si son inferidos.";

    public GeminiExtractor(HttpClient http, IConfiguration cfg)
    {
        _http = http;
        _apiKey = cfg["Gemini:ApiKey"];
        _model = string.IsNullOrWhiteSpace(cfg["Gemini:Model"]) ? "gemini-2.5-flash" : cfg["Gemini:Model"]!;
    }

    public async Task<ExtraccionResultado?> ExtraerAsync(
        string empresa, string? asunto, DateTime fechaMail, string texto, CancellationToken ct)
    {
        if (!Configurado) return null;

        var textoLimitado = texto.Length > 6000 ? texto[..6000] : texto;
        var contenido =
            $"Empresa: {empresa}\nAsunto: {asunto}\nFecha del mail: {fechaMail:yyyy-MM-dd}\n\n" +
            $"Contenido:\n{textoLimitado}\n\n{Prompt}";

        var body = new
        {
            contents = new[] { new { parts = new[] { new { text = contenido } } } },
            generationConfig = new
            {
                temperature = 0,
                responseMimeType = "application/json",
                responseSchema = BuildSchema()
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";
        using var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        using var resp = await _http.PostAsync(url, content, ct);
        if (!resp.IsSuccessStatusCode) return null;

        var raw = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("candidates", out var cands) || cands.GetArrayLength() == 0)
            return null;

        var text = cands[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
        return string.IsNullOrWhiteSpace(text) ? null : JsonSerializer.Deserialize<ExtraccionResultado>(text);
    }

    // Schema de Gemini (OpenAPI subset): tipos en MAYÚSCULA, nullable para opcionales.
    private static object BuildSchema() => new
    {
        type = "OBJECT",
        properties = new Dictionary<string, object>
        {
            ["monto_total"] = new { type = "NUMBER", nullable = true },
            ["moneda"] = new { type = "STRING", @enum = new[] { "ARS", "USD" }, nullable = true },
            ["fecha_vencimiento"] = new { type = "STRING", nullable = true },
            ["fecha_vencimiento_2"] = new { type = "STRING", nullable = true },
            ["periodo"] = new { type = "STRING", nullable = true },
            ["empresa"] = new { type = "STRING", nullable = true },
            ["confianza"] = new { type = "STRING", @enum = new[] { "alta", "media", "baja" } }
        },
        required = new[]
        {
            "monto_total", "moneda", "fecha_vencimiento", "fecha_vencimiento_2",
            "periodo", "empresa", "confianza"
        }
    };
}
