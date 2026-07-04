using Microsoft.AspNetCore.Identity;

namespace ScientificTangle.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public DateTime? LastLoginAtUtc { get; set; }
}
