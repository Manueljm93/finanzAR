using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Security.Claims;
using System.Text;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient("incomes", c =>
    c.BaseAddress = new Uri(builder.Configuration["Services:IncomesApi"]!));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        var jwt = builder.Configuration.GetSection("Jwt");
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

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "reports" }));

app.MapGet("/reports/monthly", async (
    [FromQuery] int year,
    [FromQuery] int month,
    IHttpClientFactory httpFactory,
    ClaimsPrincipal user,
    HttpContext ctx) =>
{
    var accessToken = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");

    var incomesClient = httpFactory.CreateClient("incomes");
    incomesClient.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

    var incomes = await incomesClient.GetFromJsonAsync<List<IncomeDto>>(
        $"/incomes?year={year}&month={month}") ?? [];

    var pdfBytes = Document.Create(container =>
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(2, Unit.Centimetre);
            page.DefaultTextStyle(x => x.FontSize(11));

            page.Header().Column(col =>
            {
                col.Item().Text($"Resumen Mensual — {GetMonthName(month)} {year}")
                    .FontSize(18).Bold();
                col.Item().Height(10);
            });

            page.Content().Column(col =>
            {
                col.Item().Text("Ingresos del período").Bold().FontSize(13);
                col.Item().Height(8);

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn();
                        c.ConstantColumn(90);
                        c.ConstantColumn(90);
                    });

                    table.Header(h =>
                    {
                        foreach (var header in new[] { "Concepto", "ARS", "USD" })
                            h.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text(header).Bold();
                    });

                    foreach (var income in incomes)
                    {
                        table.Cell().Padding(4).Text(income.Description);
                        table.Cell().Padding(4).AlignRight()
                            .Text(income.Currency == "ARS" ? $"${income.Amount:N2}" : "-");
                        table.Cell().Padding(4).AlignRight()
                            .Text(income.Currency == "USD" ? $"U$S{income.Amount:N2}" : "-");
                    }
                });

                col.Item().Height(15);

                var totalARS = incomes.Where(i => i.Currency == "ARS").Sum(i => i.Amount);
                var totalUSD = incomes.Where(i => i.Currency == "USD").Sum(i => i.Amount);

                col.Item().Row(row =>
                {
                    row.RelativeItem().Text($"Total ARS: ${totalARS:N2}").Bold();
                    row.RelativeItem().Text($"Total USD: U$S{totalUSD:N2}").Bold();
                });
            });

            page.Footer().AlignCenter()
                .Text(DateTime.Now.ToString("dd/MM/yyyy HH:mm"))
                .Italic().FontColor(Colors.Grey.Medium);
        });
    }).GeneratePdf();

    return Results.File(pdfBytes, "application/pdf",
        $"resumen_{year}_{month:D2}.pdf");
}).RequireAuthorization();

app.Run();

static string GetMonthName(int month) => new DateTime(2000, month, 1).ToString("MMMM",
    new System.Globalization.CultureInfo("es-AR"));

record IncomeDto(Guid Id, decimal Amount, string Currency, DateOnly Date, string Description, Guid? EntityId);
