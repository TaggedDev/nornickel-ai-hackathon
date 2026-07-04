using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ScientificTangle.Infrastructure.Persistence;

public static class ServiceProviderDatabaseExtensions
{
    public static async Task ApplyDatabaseMigrationsAsync(this IServiceProvider serviceProvider,
        CancellationToken cancellationToken = default)
    {
        var dbContext = serviceProvider.GetRequiredService<ScientificTangleIdentityDbContext>();
        await dbContext.BaselineExistingSchemaAsync(cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);
    }

    private static async Task BaselineExistingSchemaAsync(this ScientificTangleIdentityDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                "MigrationId" character varying(150) NOT NULL,
                "ProductVersion" character varying(32) NOT NULL,
                CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
            );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT '20260704135127_InitialIdentitySchema', '8.0.8'
            WHERE to_regclass('public."AspNetRoles"') IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM "__EFMigrationsHistory"
                  WHERE "MigrationId" = '20260704135127_InitialIdentitySchema'
              );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT '20260704142345_AddChatManagement', '8.0.8'
            WHERE to_regclass('public."Chats"') IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM "__EFMigrationsHistory"
                  WHERE "MigrationId" = '20260704142345_AddChatManagement'
              );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Chats"
            ADD COLUMN IF NOT EXISTS "RepresentedKnowledgeGraphNodeIdsJson" text NOT NULL DEFAULT '[]';
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Chats"
            ADD COLUMN IF NOT EXISTS "KnowledgeContextJson" jsonb NULL;
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT '20260704160000_AddChatKnowledgeGraphNodeIds', '8.0.8'
            WHERE EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'Chats'
                    AND column_name = 'RepresentedKnowledgeGraphNodeIdsJson'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM "__EFMigrationsHistory"
                  WHERE "MigrationId" = '20260704160000_AddChatKnowledgeGraphNodeIds'
              );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT '20260704223000_AddChatKnowledgeContext', '8.0.8'
            WHERE EXISTS (
                  SELECT 1
                  FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'Chats'
                    AND column_name = 'KnowledgeContextJson'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM "__EFMigrationsHistory"
                  WHERE "MigrationId" = '20260704223000_AddChatKnowledgeContext'
              );
            """, cancellationToken);
    }
}
