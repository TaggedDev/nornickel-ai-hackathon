using Microsoft.AspNetCore.Identity;

namespace ScientificTangle.Infrastructure.Identity;

public static class RoleSeeder
{
    public static async Task SeedAsync(RoleManager<ApplicationRole> roleManager)
    {
        foreach (var (name, displayName) in RoleCatalog.Roles)
        {
            var existingRole = await roleManager.FindByNameAsync(name);
            if (existingRole is null)
            {
                await roleManager.CreateAsync(new ApplicationRole
                {
                    Name = name,
                    NormalizedName = name.ToUpperInvariant(),
                    DisplayName = displayName
                });
                continue;
            }

            if (existingRole.DisplayName == displayName)
            {
                continue;
            }

            existingRole.DisplayName = displayName;
            await roleManager.UpdateAsync(existingRole);
        }
    }
}
