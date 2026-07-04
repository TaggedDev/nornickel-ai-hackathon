using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ScientificTangle.Infrastructure.Persistence;

public sealed class ScientificTangleIdentityDbContextFactory : IDesignTimeDbContextFactory<ScientificTangleIdentityDbContext>
{
    public ScientificTangleIdentityDbContext CreateDbContext(string[] args)
    {
        var basePath = Path.Combine(Directory.GetCurrentDirectory(), "..", "ScientificTangle.Web");
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("ScientificTangleDatabase") ??
                               throw new InvalidOperationException(
                                   "Connection string 'ScientificTangleDatabase' was not found.");

        var optionsBuilder = new DbContextOptionsBuilder<ScientificTangleIdentityDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new ScientificTangleIdentityDbContext(optionsBuilder.Options);
    }
}
