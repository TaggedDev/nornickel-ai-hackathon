using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ScientificTangle.Infrastructure.Persistence;

public static class ServiceProviderDatabaseExtensions
{
    public static async Task ApplyDatabaseMigrationsAsync(this IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
    {
        var dbContext = serviceProvider.GetRequiredService<ScientificTangleIdentityDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);
    }
}
