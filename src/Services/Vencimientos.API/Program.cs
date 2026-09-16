using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using FinanzasAR.Vencimientos.API.Domain;
using FinanzasAR.Vencimientos.API.Domain.Entities;
using FinanzasAR.Vencimientos.API.Infrastructure.Extraction;
using FinanzasAR.Vencimientos.API.Infrastructure.Gmail;
using FinanzasAR.Vencimientos.API.Infrastructure.Persistence;
using FinanzasAR.Vencimientos.API.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

builder.Services.ConfigureHttpJsonOptions(opt =>
    opt.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<VencimientosDbContext>(opt =>
    opt.UseSqlServer(cfg.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "vencimientos")));

builder.Services.AddSingleton(new TokenCipher(cfg["Encryption:Key"]!));
builder.Services.AddSingleton(new GoogleOAuthService(
    cfg["Google:ClientId"]!, cfg["Google:ClientSecret"]!, cfg["Google:RedirectUri"]!, cfg["Jwt:Key"]!));
builder.Services.AddSingleton<GmailScanner>();
builder.Services.AddHttpClient<GeminiExtractor>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        var jwt = cfg.GetSection("Jwt");
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"]
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<VencimientosDbContext>();
    db.Database.EnsureCreated();
}

app.UseAuthentication();
app.UseAuthorization();

static Guid Uid(ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue(ClaimTypes.NameIdentifier)!);

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "vencimientos" }));

// ---------------- OAuth Gmail ----------------

app.MapGet("/vencimientos/oauth/url", (ClaimsPrincipal user, GoogleOAuthService oauth) =>
    Results.Ok(new { url = oauth.BuildAuthUrl(Uid(user)) })
).RequireAuthorization();

// Callback de Google: llega desde el navegador SIN JWT → anónimo, valida el state firmado.
app.MapGet("/vencimientos/oauth/callback", async (
    [FromQuery] string? code,
    [FromQuery] string? state,
    VencimientosDbContext db,
    GoogleOAuthService oauth,
    GmailScanner scanner,
    TokenCipher cipher,
    CancellationToken ct) =>
{
    var front = cfg["Frontend:Url"] ?? "http://localhost:4200";
    if (string.IsNullOrEmpty(code) || !oauth.TryReadState(state, out var userId))
    {
        app.Logger.LogWarning("OAuth callback: code/state inválido (codePresent={C}, statePresent={S})",
            !string.IsNullOrEmpty(code), !string.IsNullOrEmpty(state));
        return Results.Redirect($"{front}/vencimientos?error=oauth");
    }

    try
    {
        app.Logger.LogInformation("OAuth callback: userId={U}, intercambiando code…", userId);
        var token = await oauth.ExchangeAsync(code, ct);
        app.Logger.LogInformation("OAuth callback: exchange OK, refreshToken presente={P}",
            !string.IsNullOrEmpty(token.RefreshToken));

        var conn = await db.GmailConnections.FirstOrDefaultAsync(c => c.UserId == userId, ct);

        string refreshCifrado;
        if (!string.IsNullOrEmpty(token.RefreshToken)) refreshCifrado = cipher.Encrypt(token.RefreshToken);
        else if (conn is not null) refreshCifrado = conn.RefreshTokenCifrado;   // reusar el anterior
        else { app.Logger.LogWarning("OAuth callback: sin refreshToken y sin conexión previa"); return Results.Redirect($"{front}/vencimientos?error=norefresh"); }

        var gmail = oauth.BuildGmailService(cipher.Decrypt(refreshCifrado));
        var email = await scanner.ObtenerEmailCuentaAsync(gmail, ct);
        app.Logger.LogInformation("OAuth callback: perfil Gmail OK, email={E}", email);

        if (conn is null) db.GmailConnections.Add(GmailConnection.Create(userId, email, refreshCifrado));
        else conn.Actualizar(email, refreshCifrado);
        await db.SaveChangesAsync(ct);
        app.Logger.LogInformation("OAuth callback: conexión guardada para userId={U}", userId);

        return Results.Redirect($"{front}/vencimientos?connected=1");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "OAuth callback: FALLÓ");
        return Results.Redirect($"{front}/vencimientos?error=oauth");
    }
});

app.MapGet("/vencimientos/connection", async (ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var conn = await db.GmailConnections.FirstOrDefaultAsync(c => c.UserId == userId, ct);
    return Results.Ok(new { connected = conn is not null, email = conn?.Email, ultimaSync = conn?.UltimaSync });
}).RequireAuthorization();

app.MapDelete("/vencimientos/connection", async (ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var conn = await db.GmailConnections.FirstOrDefaultAsync(c => c.UserId == userId, ct);
    if (conn is not null) { db.GmailConnections.Remove(conn); await db.SaveChangesAsync(ct); }
    return Results.NoContent();
}).RequireAuthorization();

// ---------------- Remitentes ----------------

app.MapGet("/vencimientos/remitentes", async (ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var items = await db.Remitentes.Where(r => r.UserId == userId)
        .OrderBy(r => r.Empresa).ToListAsync(ct);
    return Results.Ok(items);
}).RequireAuthorization();

// Carga los remitentes sugeridos que el usuario todavía no tenga.
app.MapPost("/vencimientos/remitentes/defaults", async (ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var existentes = await db.Remitentes.Where(r => r.UserId == userId)
        .Select(r => r.Email).ToListAsync(ct);
    var set = existentes.ToHashSet();
    var nuevos = RemitentesDefaults.Lista
        .Where(d => !set.Contains(d.Email.ToLowerInvariant()))
        .Select(d => Remitente.Create(userId, d.Email, d.Empresa))
        .ToList();
    db.Remitentes.AddRange(nuevos);
    await db.SaveChangesAsync(ct);
    return Results.Ok(new { agregados = nuevos.Count });
}).RequireAuthorization();

app.MapPost("/vencimientos/remitentes", async (
    [FromBody] CrearRemitenteRequest req, ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var r = Remitente.Create(Uid(user), req.Email, req.Empresa);
    db.Remitentes.Add(r);
    await db.SaveChangesAsync(ct);
    return Results.Created($"/vencimientos/remitentes/{r.Id}", r);
}).RequireAuthorization();

app.MapPut("/vencimientos/remitentes/{id:guid}", async (
    Guid id, [FromBody] EditarRemitenteRequest req, ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var r = await db.Remitentes.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
    if (r is null) return Results.NotFound();
    r.Update(req.Email, req.Empresa, req.Activo);
    await db.SaveChangesAsync(ct);
    return Results.Ok(r);
}).RequireAuthorization();

app.MapDelete("/vencimientos/remitentes/{id:guid}", async (
    Guid id, ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    var r = await db.Remitentes.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
    if (r is null) return Results.NotFound();
    db.Remitentes.Remove(r);
    await db.SaveChangesAsync(ct);
    return Results.NoContent();
}).RequireAuthorization();

// ---------------- Vencimientos ----------------

app.MapGet("/vencimientos", async (ClaimsPrincipal user, VencimientosDbContext db, CancellationToken ct) =>
{
    var userId = Uid(user);
    // Ventana móvil: desde 7 días antes del 1° del mes actual hasta el último día del mes actual.
    var hoy = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(-3)); // hora Argentina (UTC-3)
    var inicioMes = new DateOnly(hoy.Year, hoy.Month, 1);
    var desde = inicioMes.AddDays(-7);
    var hasta = inicioMes.AddMonths(1).AddDays(-1);

    var items = (await db.Vencimientos
            .Where(v => v.UserId == userId && v.FechaVencimiento != null
                        && v.FechaVencimiento >= desde && v.FechaVencimiento <= hasta)
            .ToListAsync(ct))
        .GroupBy(v => v.Empresa)
        .Select(g => g.OrderBy(v => v.FechaVencimiento).First())  // una por compañía: la de vencimiento más próximo
        .OrderBy(v => v.FechaVencimiento)
        .ToList();
    return Results.Ok(items);
}).RequireAuthorization();

// Escanea Gmail, extrae con Claude y guarda los vencimientos nuevos.
app.MapPost("/vencimientos/sync", async (
    ClaimsPrincipal user,
    VencimientosDbContext db,
    GoogleOAuthService oauth,
    GmailScanner scanner,
    GeminiExtractor extractor,
    TokenCipher cipher,
    CancellationToken ct) =>
{
    var userId = Uid(user);
    if (!extractor.Configurado)
        return Results.BadRequest(new { error = "Falta configurar GEMINI_API_KEY en el servidor." });

    var conn = await db.GmailConnections.FirstOrDefaultAsync(c => c.UserId == userId, ct);
    if (conn is null) return Results.BadRequest(new { error = "Gmail no está conectado." });

    var remitentes = await db.Remitentes.Where(r => r.UserId == userId && r.Activo).ToListAsync(ct);
    if (remitentes.Count == 0)
        return Results.Ok(new { procesados = 0, nuevos = 0, mensaje = "No hay remitentes activos." });

    var gmail = oauth.BuildGmailService(cipher.Decrypt(conn.RefreshTokenCifrado));
    // Cada remitente se escanea desde su propio UltimoProcesado (los recién agregados -> últimos 90 días).
    var mails = await scanner.EscanearAsync(gmail, remitentes.Select(r => (r.Email, r.UltimoProcesado)), ct);

    // Guardamos todo lo escaneado (dedup solo por id de mail). El filtrado por ventana de fechas
    // y "una por compañía" se aplica al mostrar (GET /vencimientos), porque la ventana es móvil.
    var procesadosMsgId = (await db.Vencimientos.Where(v => v.UserId == userId)
        .Select(v => v.GmailMessageId).ToListAsync(ct)).ToHashSet();

    app.Logger.LogInformation("Sync: {N} mails encontrados para {R} remitentes activos", mails.Count, remitentes.Count);

    var nuevos = 0;
    foreach (var mail in mails)
    {
        if (!procesadosMsgId.Add(mail.MessageId)) continue;   // este mail ya fue procesado
        var empresa = remitentes.FirstOrDefault(r => r.Email == mail.FromEmail)?.Empresa ?? mail.FromEmail;
        var extra = await extractor.ExtraerAsync(empresa, mail.Subject, mail.Date, mail.Body, ct);
        var fechaExtraida = ParseFecha(extra?.FechaVencimiento);
        // Sin fecha de vencimiento extraíble -> fallback a la fecha de recepción del mail (confianza baja).
        var fecha = fechaExtraida ?? DateOnly.FromDateTime(mail.Date.AddHours(-3)); // hora Argentina (UTC-3)
        var confianza = fechaExtraida is null ? Confianza.Baja : ParseConfianza(extra?.Confianza);
        app.Logger.LogInformation("Sync: guardado from={F} subj=\"{S}\" fechaVenc={V}{Fb} monto={M}",
            mail.FromEmail, mail.Subject, fecha, fechaExtraida is null ? " (fecha de mail)" : "", extra?.MontoTotal);

        db.Vencimientos.Add(Vencimiento.Create(
            userId, mail.MessageId, mail.FromEmail, empresa, mail.Subject, mail.Date,
            OrigenProceso.BodyMail,
            extra?.MontoTotal,
            ParseMoneda(extra?.Moneda),
            fecha,
            ParseFecha(extra?.FechaVencimiento2),
            extra?.Periodo,
            confianza,
            extra is not null));
        nuevos++;
    }

    foreach (var r in remitentes) r.MarcarProcesado();
    conn.MarcarSync();
    await db.SaveChangesAsync(ct);

    return Results.Ok(new { procesados = mails.Count, nuevos });
}).RequireAuthorization();

app.Run();

static Moneda ParseMoneda(string? s) =>
    string.Equals(s, "USD", StringComparison.OrdinalIgnoreCase) ? Moneda.USD : Moneda.ARS;

static DateOnly? ParseFecha(string? s) =>
    DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
        ? d : null;

static Confianza ParseConfianza(string? s) => s?.ToLowerInvariant() switch
{
    "alta" => Confianza.Alta,
    "media" => Confianza.Media,
    _ => Confianza.Baja
};

record CrearRemitenteRequest(string Email, string Empresa);
record EditarRemitenteRequest(string Email, string Empresa, bool Activo);
