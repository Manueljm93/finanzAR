using FinanzasAR.Expenses.API.Domain.Entities;
using FinanzasAR.Expenses.API.Infrastructure.Persistence;
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

builder.Services.AddDbContext<ExpensesDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "expenses")));

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
    var db = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
    db.Database.EnsureCreated();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "expenses" }));

// --- Gastos fijos (plantillas recurrentes) ---

app.MapGet("/expenses/fixed", async (
    ExpensesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var items = await db.FixedExpenses
        .Where(f => f.UserId == userId)
        .OrderBy(f => f.Category).ThenBy(f => f.DueDay)
        .ToListAsync();
    return Results.Ok(items);
}).RequireAuthorization();

app.MapPost("/expenses/fixed", async (
    [FromBody] CreateFixedExpenseRequest req,
    ExpensesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var expense = FixedExpense.Create(userId, req.Description, req.Amount, req.Currency, req.Category, req.DueDay);
    db.FixedExpenses.Add(expense);
    await db.SaveChangesAsync();
    return Results.Created($"/expenses/fixed/{expense.Id}", expense);
}).RequireAuthorization();

app.MapPut("/expenses/fixed/{id:guid}", async (
    Guid id,
    [FromBody] UpdateFixedExpenseRequest req,
    ExpensesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var expense = await db.FixedExpenses.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
    if (expense is null) return Results.NotFound();

    expense.Update(req.Description, req.Amount, req.Currency, req.Category, req.DueDay);
    await db.SaveChangesAsync();
    return Results.Ok(expense);
}).RequireAuthorization();

app.MapDelete("/expenses/fixed/{id:guid}", async (
    Guid id,
    ExpensesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var expense = await db.FixedExpenses.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
    if (expense is null) return Results.NotFound();

    var payments = db.ExpensePayments.Where(p => p.FixedExpenseId == id && p.UserId == userId);
    db.ExpensePayments.RemoveRange(payments);
    db.FixedExpenses.Remove(expense);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

// --- Vista mensual: cada gasto fijo con su estado de pago en el mes ---

app.MapGet("/expenses/month", async (
    ExpensesDbContext db,
    ClaimsPrincipal user,
    [FromQuery] int year,
    [FromQuery] int month) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var expenses = await db.FixedExpenses
        .Where(f => f.UserId == userId)
        .OrderBy(f => f.Category).ThenBy(f => f.DueDay)
        .ToListAsync();
    var payments = await db.ExpensePayments
        .Where(p => p.UserId == userId && p.Year == year && p.Month == month)
        .ToListAsync();
    var paidMap = payments.ToDictionary(p => p.FixedExpenseId);

    var result = expenses.Select(f =>
    {
        paidMap.TryGetValue(f.Id, out var pay);
        return new MonthlyExpenseDto(
            f.Id, f.Description, f.Amount, f.Currency, f.Category, f.DueDay,
            pay is not null, pay?.PaidAt);
    });
    return Results.Ok(result);
}).RequireAuthorization();

app.MapGet("/expenses/summary", async (
    ExpensesDbContext db,
    ClaimsPrincipal user,
    [FromQuery] int year,
    [FromQuery] int month) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var expenses = await db.FixedExpenses.Where(f => f.UserId == userId).ToListAsync();
    var paidIds = await db.ExpensePayments
        .Where(p => p.UserId == userId && p.Year == year && p.Month == month)
        .Select(p => p.FixedExpenseId)
        .ToListAsync();
    var paidSet = paidIds.ToHashSet();

    decimal Sum(Currency c, bool? paid) => expenses
        .Where(e => e.Currency == c && (paid is null || paidSet.Contains(e.Id) == paid))
        .Sum(e => e.Amount);

    return Results.Ok(new
    {
        Year = year,
        Month = month,
        TotalARS = Sum(Currency.ARS, null),
        PaidARS = Sum(Currency.ARS, true),
        PendingARS = Sum(Currency.ARS, false),
        TotalUSD = Sum(Currency.USD, null),
        PaidUSD = Sum(Currency.USD, true),
        PendingUSD = Sum(Currency.USD, false),
        Count = expenses.Count,
        PaidCount = expenses.Count(e => paidSet.Contains(e.Id))
    });
}).RequireAuthorization();

// --- Marcar / desmarcar pagado en un mes ---

app.MapPost("/expenses/fixed/{id:guid}/pay", async (
    Guid id,
    [FromBody] PayRequest req,
    ExpensesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var exists = await db.FixedExpenses.AnyAsync(f => f.Id == id && f.UserId == userId);
    if (!exists) return Results.NotFound();

    var already = await db.ExpensePayments
        .AnyAsync(p => p.FixedExpenseId == id && p.UserId == userId && p.Year == req.Year && p.Month == req.Month);
    if (!already)
    {
        db.ExpensePayments.Add(ExpensePayment.Create(userId, id, req.Year, req.Month));
        await db.SaveChangesAsync();
    }
    return Results.NoContent();
}).RequireAuthorization();

app.MapDelete("/expenses/fixed/{id:guid}/pay", async (
    Guid id,
    ExpensesDbContext db,
    ClaimsPrincipal user,
    [FromQuery] int year,
    [FromQuery] int month) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var payment = await db.ExpensePayments
        .FirstOrDefaultAsync(p => p.FixedExpenseId == id && p.UserId == userId && p.Year == year && p.Month == month);
    if (payment is null) return Results.NoContent();

    db.ExpensePayments.Remove(payment);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.Run();

record CreateFixedExpenseRequest(string Description, decimal Amount, Currency Currency, ExpenseCategory Category, int DueDay);
record UpdateFixedExpenseRequest(string Description, decimal Amount, Currency Currency, ExpenseCategory Category, int DueDay);
record PayRequest(int Year, int Month);
record MonthlyExpenseDto(
    Guid FixedExpenseId, string Description, decimal Amount, Currency Currency,
    ExpenseCategory Category, int DueDay, bool Paid, DateTime? PaidAt);
