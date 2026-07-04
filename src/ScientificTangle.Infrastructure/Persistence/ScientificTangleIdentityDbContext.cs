using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ScientificTangle.Infrastructure.Identity;

namespace ScientificTangle.Infrastructure.Persistence;

public sealed class ScientificTangleIdentityDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>
{
    public ScientificTangleIdentityDbContext(DbContextOptions<ScientificTangleIdentityDbContext> options) :
        base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(user => user.LastName).HasMaxLength(100).IsRequired();
            entity.Property(user => user.CreatedAtUtc).IsRequired();
            entity.Property(user => user.UpdatedAtUtc).IsRequired();
        });

        builder.Entity<ApplicationRole>(entity =>
        {
            entity.Property(role => role.DisplayName).HasMaxLength(100).IsRequired();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ApplicationUser>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
                entry.Entity.UpdatedAtUtc = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}