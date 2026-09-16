using FinanzasAR.Incomes.API.Domain.Entities;
using FinanzasAR.Incomes.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(opt =>
    opt.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<IncomesDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "incomes")));

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

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IncomesDbContext>();
    db.Database.EnsureCreated();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "incomes" }));

app.MapGet("/incomes", async (
    IncomesDbContext db,
    ClaimsPrincipal user,
    [FromQuery] int? year,
    [FromQuery] int? month) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var query = db.Incomes.Where(i => i.UserId == userId);
    if (year.HasValue) query = query.Where(i => i.Year == year.Value);
    if (month.HasValue) query = query.Where(i => i.Month == month.Value);
    return Results.Ok(await query.OrderByDescending(i => i.Date).ToListAsync());
}).RequireAuthorization();

app.MapGet("/incomes/summary", async (
    IncomesDbContext db,
    ClaimsPrincipal user,
    [FromQuery] int year,
    [FromQuery] int month) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var incomes = await db.Incomes
        .Where(i => i.UserId == userId && i.Year == year && i.Month == month)
        .ToListAsync();

    return Results.Ok(new
    {
        Year = year,
        Month = month,
        TotalARS = incomes.Where(i => i.Currency == Currency.ARS).Sum(i => i.Amount),
        TotalUSD = incomes.Where(i => i.Currency == Currency.USD).Sum(i => i.Amount),
        Count = incomes.Count
    });
}).RequireAuthorization();

app.MapPost("/incomes", async (
    [FromBody] CreateIncomeRequest req,
    IncomesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var income = Income.Create(userId, req.Amount, req.Currency, req.Date, req.Description, req.EntityId);
    db.Incomes.Add(income);
    await db.SaveChangesAsync();
    return Results.Created($"/incomes/{income.Id}", income);
}).RequireAuthorization();

app.MapPut("/incomes/{id:guid}", async (
    Guid id,
    [FromBody] UpdateIncomeRequest req,
    IncomesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var income = await db.Incomes.FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId);
    if (income is null) return Results.NotFound();

    income.Update(req.Amount, req.Currency, req.Date, req.Description, req.EntityId);
    await db.SaveChangesAsync();
    return Results.Ok(income);
}).RequireAuthorization();

app.MapDelete("/incomes/{id:guid}", async (
    Guid id,
    IncomesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var income = await db.Incomes.FirstOrDefaultAsync(i => i.Id == id && i.UserId == userId);
    if (income is null) return Results.NotFound();

    db.Incomes.Remove(income);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.Run();

record CreateIncomeRequest(decimal Amount, Currency Currency, DateOnly Date, string Description, Guid? EntityId);
record UpdateIncomeRequest(decimal Amount, Currency Currency, DateOnly Date, string Description, Guid? EntityId);
