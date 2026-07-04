using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ScientificTangle.Core.Chats;
using ScientificTangle.Infrastructure.Identity;

namespace ScientificTangle.Infrastructure.Persistence;

public sealed class ScientificTangleIdentityDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, string>
{
    public ScientificTangleIdentityDbContext(DbContextOptions<ScientificTangleIdentityDbContext> options) :
        base(options)
    {
    }

    public DbSet<Chat> Chats => Set<Chat>();

    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    public DbSet<ChatPin> ChatPins => Set<ChatPin>();

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

        builder.Entity<Chat>(entity =>
        {
            entity.ToTable("Chats");
            entity.HasKey(chat => chat.Id);
            entity.Property(chat => chat.OwnerUserId).HasMaxLength(450).IsRequired();
            entity.Property(chat => chat.Title).HasMaxLength(60).IsRequired();
            entity.Property(chat => chat.IsPublic).IsRequired();
            entity.Property(chat => chat.CreatedAtUtc).IsRequired();
            entity.Property(chat => chat.LastActivityAtUtc).IsRequired();
            entity.HasIndex(chat => new { chat.OwnerUserId, chat.LastActivityAtUtc });
            entity.Metadata.FindNavigation(nameof(Chat.Messages))!.SetPropertyAccessMode(PropertyAccessMode.Field);
            entity.Metadata.FindNavigation(nameof(Chat.Pins))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        });

        builder.Entity<ChatMessage>(entity =>
        {
            entity.ToTable("ChatMessages");
            entity.HasKey(message => message.Id);
            entity.Property(message => message.Text).IsRequired();
            entity.Property(message => message.Sender).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(message => message.CreatedAtUtc).IsRequired();
            entity.HasIndex(message => new { message.ChatId, message.CreatedAtUtc });
            entity.HasOne<Chat>()
                .WithMany(chat => (IEnumerable<ChatMessage>)chat.Messages)
                .HasForeignKey(message => message.ChatId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ChatPin>(entity =>
        {
            entity.ToTable("ChatPins");
            entity.HasKey(pin => new { pin.ChatId, pin.UserId });
            entity.Property(pin => pin.UserId).HasMaxLength(450).IsRequired();
            entity.Property(pin => pin.PinnedAtUtc).IsRequired();
            entity.HasIndex(pin => pin.UserId);
            entity.HasOne(pin => pin.Chat)
                .WithMany(chat => (IEnumerable<ChatPin>)chat.Pins)
                .HasForeignKey(pin => pin.ChatId)
                .OnDelete(DeleteBehavior.Cascade);
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
