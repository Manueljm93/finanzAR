using BCrypt.Net;
using FinanzasAR.Identity.API.Domain.Entities;
using FinanzasAR.Identity.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<IdentityDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "identity")));

var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSettings["Key"]!;

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    db.Database.EnsureCreated();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "identity" }));

app.MapPost("/auth/register", async (
    [FromBody] RegisterRequest req,
    IdentityDbContext db) =>
{
    if (await db.Users.AnyAsync(u => u.Email == req.Email.ToLower()))
        return Results.Conflict("El email ya está registrado.");

    var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);
    var user = User.Create(req.Email, hash);
    db.Users.Add(user);
    await db.SaveChangesAsync();
    return Results.Created($"/auth/{user.Id}", new { user.Id, user.Email });
});

app.MapPost("/auth/login", async (
    [FromBody] LoginRequest req,
    IdentityDbContext db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLower());
    if (user is null || !user.VerifyPassword(req.Password))
        return Results.Unauthorized();

    var token = GenerateJwt(user, jwtKey, jwtSettings["Issuer"]!, jwtSettings["Audience"]!);
    var refreshToken = RefreshToken.Create(user.Id, Guid.NewGuid().ToString("N"));
    db.RefreshTokens.Add(refreshToken);
    await db.SaveChangesAsync();

    return Results.Ok(new { accessToken = token, refreshToken = refreshToken.Token });
});

app.MapPost("/auth/refresh", async (
    [FromBody] RefreshRequest req,
    IdentityDbContext db) =>
{
    var stored = await db.RefreshTokens
        .FirstOrDefaultAsync(rt => rt.Token == req.RefreshToken && !rt.IsRevoked);

    if (stored is null || stored.IsExpired)
        return Results.Unauthorized();

    var user = await db.Users.FindAsync(stored.UserId);
    if (user is null) return Results.Unauthorized();

    stored.Revoke();
    var newRefresh = RefreshToken.Create(user.Id, Guid.NewGuid().ToString("N"));
    db.RefreshTokens.Add(newRefresh);
    await db.SaveChangesAsync();

    var token = GenerateJwt(user, jwtKey, jwtSettings["Issuer"]!, jwtSettings["Audience"]!);
    return Results.Ok(new { accessToken = token, refreshToken = newRefresh.Token });
});

app.Run();

static string GenerateJwt(User user, string key, string issuer, string audience)
{
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };
    var credentials = new SigningCredentials(
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(issuer, audience, claims,
        expires: DateTime.UtcNow.AddHours(8), signingCredentials: credentials);
    return new JwtSecurityTokenHandler().WriteToken(token);
}

record RegisterRequest(string Email, string Password);
record LoginRequest(string Email, string Password);
record RefreshRequest(string RefreshToken);
