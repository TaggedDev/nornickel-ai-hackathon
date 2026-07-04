using Microsoft.AspNetCore.Identity;

namespace ScientificTangle.Infrastructure.Identity;

public sealed class ApplicationRole : IdentityRole
{
    public string DisplayName { get; set; } = string.Empty;
}
