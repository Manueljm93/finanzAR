using FinanzasAR.Entities.API.Domain.Entities;
using FinanzasAR.Entities.API.Infrastructure.Persistence;
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

builder.Services.AddDbContext<EntitiesDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "entities")));

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
    var db = scope.ServiceProvider.GetRequiredService<EntitiesDbContext>();
    db.Database.EnsureCreated();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "entities" }));

app.MapGet("/entities", async (EntitiesDbContext db, ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    return Results.Ok(await db.FinancialEntities
        .Where(e => e.UserId == userId)
        .OrderBy(e => e.Name)
        .ToListAsync());
}).RequireAuthorization();

app.MapPost("/entities", async (
    [FromBody] CreateEntityRequest req,
    EntitiesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var entity = FinancialEntity.Create(userId, req.Name, req.Type);
    db.FinancialEntities.Add(entity);
    await db.SaveChangesAsync();
    return Results.Created($"/entities/{entity.Id}", entity);
}).RequireAuthorization();

app.MapPut("/entities/{id:guid}", async (
    Guid id,
    [FromBody] UpdateEntityRequest req,
    EntitiesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var entity = await db.FinancialEntities.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);
    if (entity is null) return Results.NotFound();

    entity.Update(req.Name, req.Type, req.IsActive);
    await db.SaveChangesAsync();
    return Results.Ok(entity);
}).RequireAuthorization();

app.MapDelete("/entities/{id:guid}", async (
    Guid id,
    EntitiesDbContext db,
    ClaimsPrincipal user) =>
{
    var userId = Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var entity = await db.FinancialEntities.FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId);
    if (entity is null) return Results.NotFound();

    db.FinancialEntities.Remove(entity);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.Run();

record CreateEntityRequest(string Name, EntityType Type);
record UpdateEntityRequest(string Name, EntityType Type, bool IsActive);
