using FinanzasAR.Vencimientos.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinanzasAR.Vencimientos.API.Infrastructure.Persistence;

public class VencimientosDbContext(DbContextOptions<VencimientosDbContext> options) : DbContext(options)
{
    public DbSet<Remitente> Remitentes => Set<Remitente>();
    public DbSet<Vencimiento> Vencimientos => Set<Vencimiento>();
    public DbSet<GmailConnection> GmailConnections => Set<GmailConnection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("vencimientos");

        modelBuilder.Entity<Remitente>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Empresa).HasMaxLength(200);
            e.HasIndex(x => new { x.UserId, x.Email }).IsUnique();
        });

        modelBuilder.Entity<Vencimiento>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.MontoTotal).HasPrecision(18, 2);
            e.Property(x => x.Moneda).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.Confianza).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.ProcesadoCon).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.GmailMessageId).HasMaxLength(128);
            e.Property(x => x.RemitenteEmail).HasMaxLength(256);
            e.Property(x => x.Empresa).HasMaxLength(200);
            e.Property(x => x.Asunto).HasMaxLength(500);
            e.Property(x => x.Periodo).HasMaxLength(100);
            e.HasIndex(x => new { x.UserId, x.GmailMessageId }).IsUnique();
        });

        modelBuilder.Entity<GmailConnection>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.RefreshTokenCifrado).HasMaxLength(2000);
            e.HasIndex(x => x.UserId).IsUnique();
        });
    }
}
