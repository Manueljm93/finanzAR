using FinanzasAR.Monotributo.API.Domain.Entities;
using FinanzasAR.Monotributo.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<MonotributoDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "monotributo")));

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

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MonotributoDbContext>();
    db.Database.EnsureCreated();
    await SeedCategoriesAsync(db);
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "monotributo" }));

app.MapGet("/monotributo/categories", async (MonotributoDbContext db) =>
{
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    return Results.Ok(await db.Categories
        .Where(c => c.ValidFrom <= today && (c.ValidTo == null || c.ValidTo >= today))
        .OrderBy(c => c.MaxAnnualIncome)
        .ToListAsync());
}).RequireAuthorization();

app.MapGet("/monotributo/status", async (
    [FromQuery] int year,
    MonotributoDbContext db,
    IHttpClientFactory httpFactory,
    ClaimsPrincipal user,
    HttpContext ctx) =>
{
    var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");

    var client = httpFactory.CreateClient("incomes");
    client.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    var response = await client.GetFromJsonAsync<IncomeSummaryResponse[]>(
        $"/incomes?year={year}");

    var totalARS = response?.Sum(i => i.Amount) ?? 0m;

    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var categories = await db.Categories
        .Where(c => c.ValidFrom <= today && (c.ValidTo == null || c.ValidTo >= today))
        .OrderBy(c => c.MaxAnnualIncome)
        .ToListAsync();

    var current = categories.FirstOrDefault(c => c.MaxAnnualIncome >= totalARS);
    var next = current is not null
        ? categories.FirstOrDefault(c => c.MaxAnnualIncome > current.MaxAnnualIncome)
        : null;

    return Results.Ok(new
    {
        Year = year,
        AccumulatedARS = totalARS,
        CurrentCategory = current?.Letter,
        CurrentCategoryLimit = current?.MaxAnnualIncome,
        NextCategory = next?.Letter,
        NextCategoryLimit = next?.MaxAnnualIncome,
        RemainingToNext = next is not null ? next.MaxAnnualIncome - totalARS : (decimal?)null
    });
}).RequireAuthorization();

app.MapGet("/monotributo/history", async (
    [FromQuery] int year,
    MonotributoDbContext db,
    IHttpClientFactory httpFactory,
    ClaimsPrincipal user,
    HttpContext ctx) =>
{
    var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
    var client = httpFactory.CreateClient("incomes");
    client.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    var response = await client.GetFromJsonAsync<IncomeSummaryResponse[]>(
        $"/incomes?year={year}");

    var byMonth = response?
        .GroupBy(i => i.Month)
        .Select(g => new { Month = g.Key, TotalARS = g.Sum(i => i.Amount) })
        .OrderBy(x => x.Month)
        ?? Enumerable.Empty<object>();

    return Results.Ok(byMonth);
}).RequireAuthorization();

app.MapGet("/monotributo/goal", async (MonotributoDbContext db, ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var goal = await db.MonthlyGoals.FirstOrDefaultAsync(g => g.UserId == userId);
    return Results.Ok(new { amount = goal?.Amount ?? 0m });
}).RequireAuthorization();

app.MapPut("/monotributo/goal", async (
    [FromBody] SetGoalRequest req,
    MonotributoDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var goal = await db.MonthlyGoals.FirstOrDefaultAsync(g => g.UserId == userId);
    if (goal is null)
    {
        goal = MonthlyGoal.Create(userId, req.Amount);
        db.MonthlyGoals.Add(goal);
    }
    else
    {
        goal.SetAmount(req.Amount);
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { amount = goal.Amount });
}).RequireAuthorization();

app.Run();

static async Task SeedCategoriesAsync(MonotributoDbContext db)
{
    if (await db.Categories.AnyAsync()) return;

    var validFrom = new DateOnly(2026, 2, 1);
    var cats = new[]
    {
        Category.Create("A",  10_277_988.13m,  4_780.46m,  15_616.17m, 21_990.11m, validFrom),
        Category.Create("B",  15_058_447.71m,  9_082.88m,  17_177.79m, 21_990.11m, validFrom),
        Category.Create("C",  21_113_696.52m, 15_616.17m,  18_895.57m, 21_990.11m, validFrom),
        Category.Create("D",  26_212_853.42m, 25_495.79m,  20_785.13m, 26_133.18m, validFrom),
        Category.Create("E",  30_833_964.37m, 47_804.60m,  22_863.64m, 31_869.73m, validFrom),
        Category.Create("F",  38_642_048.36m, 67_245.13m,  25_150.00m, 36_650.19m, validFrom),
        Category.Create("G",  46_211_109.37m,122_379.76m,  35_210.00m, 39_518.47m, validFrom),
        Category.Create("H",  70_113_407.33m,350_567.04m,  49_294.00m, 47_485.89m, validFrom),
        Category.Create("I",  78_479_211.62m,697_150.35m,  69_011.60m, 58_640.31m, validFrom),
        Category.Create("J",  89_872_640.30m,836_580.42m,  96_616.24m, 65_810.99m, validFrom),
        Category.Create("K", 108_357_084.05m,1_171_212.59m,135_262.74m, 75_212.57m, validFrom),
    };
    db.Categories.AddRange(cats);
    await db.SaveChangesAsync();
}

record IncomeSummaryResponse(decimal Amount, string Currency, int Month, int Year);
record SetGoalRequest(decimal Amount);
